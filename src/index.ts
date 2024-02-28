import * as ethers from 'ethers';
import * as zkweb3 from 'zksync-web3';
import { BigNumber } from 'ethers';
import { isOperationFeeAcceptable, minBigNumber, maxBigNumber } from './utils';
import { calculateTransferAmount } from './transfer-calculator';

/** Env parameters */

/** L2 fee account PK */
const FEE_ACCOUNT_PRIVATE_KEY = process.env.MISC_FEE_ACCOUNT_PRIVATE_KEY;

/** Addresses of accounts to distribute ETH among */
const OPERATOR_ADDRESS = process.env.OPERATOR_ADDRESS;
const BLOB_OPERATOR_ADDRESS = process.env.BLOB_OPERATOR_ADDRESS;
const WITHDRAWAL_FINALIZER_ETH_ADDRESS = process.env.WITHDRAWAL_FINALIZER_ETH_ADDRESS;
const RESERVE_FEE_ACCUMULATOR_ADDRESS = process.env.MISC_RESERVE_FEE_ACCUMULATOR_ADDRESS;
const TESTNET_PAYMASTER_ADDRESS = process.env.CONTRACTS_L2_TESTNET_PAYMASTER_ADDR;
const WATCHDOG_ADDRESS = process.env.WATCHDOG_ADDRESS;

/** API URLs */
const L1_WEB3_API_URL = process.env.L1_RPC_ADDRESS;
const ZKSYNC_WEB3_API_URL = process.env.ZKSYNC_WEB3_API_URL;

/** Thresholds */
const MAX_LIQUIDATION_FEE_PERCENT = parseInt(process.env.MISC_MAX_LIQUIDATION_FEE_PERCENT);

const LOWER_BOUND_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_OPERATOR_THRESHOLD);
const UPPER_BOUND_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_OPERATOR_THRESHOLD);

const LOWER_BOUND_WITHDRAWER_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_WITHDRAWER_THRESHOLD);
const UPPER_BOUND_WITHDRAWER_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_WITHDRAWER_THRESHOLD);

const LOWER_BOUND_PAYMASTER_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_PAYMASTER_THRESHOLD);
const UPPER_BOUND_PAYMASTER_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_PAYMASTER_THRESHOLD);

const LOWER_BOUND_WATCHDOG_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_WATCHDOG_THRESHOLD);
const UPPER_BOUND_WATCHDOG_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_WATCHDOG_THRESHOLD);

const LOWER_BOUND_BLOB_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_BLOB_OPERATOR_THRESHOLD);
const UPPER_BOUND_BLOB_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_BLOB_OPERATOR_THRESHOLD);

const L1_ETH_TRANSFER_THRESHOLD = process.env.L1_ETH_TRANSFER_THRESHOLD
    ? ethers.utils.parseEther(process.env.L1_ETH_TRANSFER_THRESHOLD)
    : ethers.utils.parseEther('3.0');

const L2_ETH_TRANSFER_THRESHOLD = process.env.L2_ETH_TRANSFER_THRESHOLD
    ? ethers.utils.parseEther(process.env.L2_ETH_TRANSFER_THRESHOLD)
    : ethers.utils.parseEther('1.0');

async function withdrawForL1TopUps(wallet: zkweb3.Wallet) {
    // There should be reserve of `L2_ETH_TRANSFER_THRESHOLD` amount on L2
    let balance = await wallet.getBalance(zkweb3.utils.ETH_ADDRESS);
    let amount = balance.sub(L2_ETH_TRANSFER_THRESHOLD);
    if (amount.lte(0)) {
        console.log(
            `Withdrawal can not be done: main wallet balance is less than l2 ETH transfer threshold;\n
            main wallet balance: ${balance};\n
            threshold: ${L2_ETH_TRANSFER_THRESHOLD}
            `
        );
        return;
    }
    // Estimate withdrawal fee.
    const tx = await wallet.provider.getWithdrawTx({
        token: zkweb3.utils.ETH_ADDRESS,
        amount,
        from: wallet.address,
        to: wallet.address
    });
    const gasLimit = await wallet.provider.estimateGas(tx);
    const gasPrice = await wallet.provider.getGasPrice();
    const fee = gasLimit.mul(gasPrice);
    if (isOperationFeeAcceptable(amount, fee, MAX_LIQUIDATION_FEE_PERCENT)) {
        amount = amount.sub(fee);
        // Send withdrawal tx.
        const withdrawHandle = await wallet.withdraw({
            token: zkweb3.utils.ETH_ADDRESS,
            amount,
            to: wallet.address,
            overrides: {
                gasPrice,
                gasLimit
            }
        });
        const hash = withdrawHandle.hash;
        console.log(
            `Withdrawing ETH, amount: ${ethers.utils.formatEther(amount)}, fee: ${ethers.utils.formatEther(fee)}, tx hash: ${hash}`
        );

        await withdrawHandle.wait();
        console.log(`Withdrawal L2 tx has succeeded, tx hash: ${hash}`);
    } else {
        console.log('Skipping withdrawing, fee slippage is too big');
    }
}

async function L2topUp(wallet: zkweb3.Wallet, amount: BigNumber, l2AccountAddress: string, l2AccountName: string) {
    // Estimate withdrawal fee.
    const tx = await wallet.provider.getTransferTx({
        token: zkweb3.utils.ETH_ADDRESS,
        amount,
        from: wallet.address,
        to: l2AccountAddress
    });
    const gasLimit = (await wallet.provider.estimateGas(tx)).mul(2);
    const gasPrice = await wallet.provider.getGasPrice();
    const fee = gasLimit.mul(gasPrice);
    if (isOperationFeeAcceptable(amount, fee, MAX_LIQUIDATION_FEE_PERCENT)) {
        const transferHandle = await wallet.transfer({
            token: zkweb3.utils.ETH_ADDRESS,
            amount,
            to: l2AccountAddress,
            overrides: {
                gasPrice,
                gasLimit
            }
        });
        const hash = transferHandle.hash;
        console.log(
            `ETH transfer to ${l2AccountName}, amount: ${ethers.utils.formatEther(amount)}, fee: ${ethers.utils.formatEther(
                fee
            )}, tx hash: ${hash}`
        );

        await transferHandle.wait();
        console.log(`Transfer to ${l2AccountName} has succeeded, tx hash: ${hash}`);
    } else {
        console.log(`Skipping transferring to ${l2AccountName}, fee slippage is too big`);
    }
}

async function retryL1Tx(initialGasPrice, ethProvider, sendTransaction: (gasPrice) => Promise<void>) {
    const MAX_TRIES = 5;
    const GAS_PRICE_INCREASE_PERCENT = 40;

    let gasPrice = initialGasPrice;
    for (let i = 0; i < MAX_TRIES; ++i) {
        try {
            await sendTransaction(gasPrice);
            break;
        } catch (err) {
            if (i == MAX_TRIES - 1) {
                console.log(`Max retries limit exceeded`);
                throw err;
            } else {
                console.log(`Received error: ${err}`);
                gasPrice = maxBigNumber(await ethProvider.getGasPrice(), gasPrice.mul(100 + GAS_PRICE_INCREASE_PERCENT).div(100));
                console.log(`Retrying with higher gas price: ${gasPrice.toString()}`);
            }
        }
    }
}

async function sendETH(ethWallet: ethers.Wallet, to: string, amount: BigNumber) {
    let gasPrice = await ethWallet.provider.getGasPrice();
    gasPrice = gasPrice.mul(2);
    const ethTransferFee = BigNumber.from('21000').mul(gasPrice);
    const balance = await ethWallet.getBalance();

    // We can not spend more than the balance of the account
    let allowedEth = maxBigNumber(balance.sub(ethTransferFee), BigNumber.from(0));
    amount = minBigNumber(amount, allowedEth);

    if (isOperationFeeAcceptable(amount, ethTransferFee, MAX_LIQUIDATION_FEE_PERCENT)) {
        await retryL1Tx(gasPrice, ethWallet.provider, async (gasPrice) => {
            const tx = await ethWallet.sendTransaction({
                to,
                value: amount,
                gasPrice
            });
            console.log(`Sending ${ethers.utils.formatEther(amount)} ETH to ${to}, tx hash: ${tx.hash}`);
            // Do not wait for more than 30 minutes
            await ethWallet.provider.waitForTransaction(tx.hash, 3, 1800000);
            console.log(`Transfer has succeded, tx hash: ${tx.hash}`);
        });
    } else {
        console.log(
            `Skipping transfer because fee/amount ratio is too high: fee ${ethers.utils.formatEther(
                ethTransferFee
            )}, amount ${ethers.utils.formatEther(amount)}`
        );
    }
}

(async () => {
    const ethProvider = new ethers.providers.JsonRpcProvider(L1_WEB3_API_URL);
    const zksyncProvider = new zkweb3.Provider(ZKSYNC_WEB3_API_URL);
    console.log('Providers are initialized');

    const wallet = new zkweb3.Wallet(FEE_ACCOUNT_PRIVATE_KEY, zksyncProvider, ethProvider);
    const ethWallet = new ethers.Wallet(FEE_ACCOUNT_PRIVATE_KEY, ethProvider);
    console.log('Wallets are initialized');

    try {
        const isMainnet = (await ethProvider.getNetwork()).chainId == 1;
        if (TESTNET_PAYMASTER_ADDRESS && isMainnet) {
            throw new Error('Testnet paymaster should not be present on mainnet deployments');
        }

        console.log(`----------------------------------------------------------------------------`);
        // get initial balances
        let l1feeAccountBalance = await ethProvider.getBalance(wallet.address);
        console.log(`Fee account L1 balance before top-up: ${ethers.utils.formatEther(l1feeAccountBalance)}`);

        let l2feeAccountBalance = await zksyncProvider.getBalance(wallet.address);
        console.log(`Fee account L2 balance before top-up: ${ethers.utils.formatEther(l2feeAccountBalance)}`);

        const operatorBalance = await ethProvider.getBalance(OPERATOR_ADDRESS);
        console.log(`Operator L1 balance before top-up: ${ethers.utils.formatEther(operatorBalance)}`);
        
        const blobOperatorBalance = await ethProvider.getBalance(BLOB_OPERATOR_ADDRESS);
        console.log(`Blob Operator L1 balance before top-up: ${ethers.utils.formatEther(blobOperatorBalance)}`);

        const withdrawerBalance = await ethProvider.getBalance(WITHDRAWAL_FINALIZER_ETH_ADDRESS);
        console.log(`Withdrawer L1 balance before top-up: ${ethers.utils.formatEther(withdrawerBalance)}`);

        const paymasterL2Balance = TESTNET_PAYMASTER_ADDRESS
            ? await zksyncProvider.getBalance(TESTNET_PAYMASTER_ADDRESS)
            : BigNumber.from(0);
        console.log(`Paymaster L2 balance before top-up: ${ethers.utils.formatEther(paymasterL2Balance)}`);

        const watchdogBalance = await zksyncProvider.getBalance(WATCHDOG_ADDRESS);
        console.log(`Watchdog L2 balance before top-up: ${ethers.utils.formatEther(watchdogBalance)}`);

        console.log(`----------------------------------------------------------------------------`);

        let transferAmount;

        // calculate amounts for top ups on L2
        if (!TESTNET_PAYMASTER_ADDRESS) {
            console.log('Skipping step 1 -- send ETH to paymaster');
        } else {
            [transferAmount, l2feeAccountBalance] = await calculateTransferAmount(
                l2feeAccountBalance,
                paymasterL2Balance,
                UPPER_BOUND_PAYMASTER_THRESHOLD,
                LOWER_BOUND_PAYMASTER_THRESHOLD,
                L2_ETH_TRANSFER_THRESHOLD
            );
            console.log(
                `Amount which main wallet can send to paymaster: ${ethers.utils.formatEther(transferAmount)} ETH;
                fee account l2 balance in this case will be ${ethers.utils.formatEther(l2feeAccountBalance)} ETH`
            );

            console.log('Step 1 - send ETH to paymaster');
            await L2topUp(wallet, transferAmount, TESTNET_PAYMASTER_ADDRESS, 'paymaster');
        }

        console.log(`----------------------------------------------------------------------------`);

        if (!WATCHDOG_ADDRESS) {
            console.log('Skipping step 2 -- send ETH to era-watchdog');
        } else {
            [transferAmount, l2feeAccountBalance] = await calculateTransferAmount(
                l2feeAccountBalance,
                watchdogBalance,
                UPPER_BOUND_WATCHDOG_THRESHOLD,
                LOWER_BOUND_WATCHDOG_THRESHOLD,
                L2_ETH_TRANSFER_THRESHOLD
            );
            console.log(
                `Amount which fee account can send to era-watchdog: ${ethers.utils.formatEther(transferAmount)} ETH;
                fee account l2 balance in this case will be ${ethers.utils.formatEther(l2feeAccountBalance)} ETH`
            );

            console.log('Step 2 - send ETH to era-watchdog');
            await L2topUp(wallet, transferAmount, WATCHDOG_ADDRESS, 'watchdog');
        }

        console.log(`----------------------------------------------------------------------------`);

        console.log('Step 3 - withdrawing tokens from ZkSync');
        await withdrawForL1TopUps(wallet);

        l2feeAccountBalance = await wallet.getBalance(wallet.address);
        console.log(`L2 fee account balance after withdraw: ${ethers.utils.formatEther(l2feeAccountBalance)} ETH`);

        l1feeAccountBalance = await ethProvider.getBalance(wallet.address);
        console.log(`L1 fee account balance after withdraw: ${ethers.utils.formatEther(l1feeAccountBalance)} ETH`);

        console.log(`----------------------------------------------------------------------------`);

        // calculate amounts for top ups on L1
        [transferAmount, l1feeAccountBalance] = await calculateTransferAmount(
            l1feeAccountBalance,
            operatorBalance,
            UPPER_BOUND_OPERATOR_THRESHOLD,
            LOWER_BOUND_OPERATOR_THRESHOLD,
            L1_ETH_TRANSFER_THRESHOLD
        );
        console.log(
            `Amount which fee account can send to operator: ${ethers.utils.formatEther(transferAmount)} ETH;
            fee account l1 balance in this case will be ${ethers.utils.formatEther(l1feeAccountBalance)} ETH`
        );

        console.log('Step 4 - send ETH to operator');
        await sendETH(ethWallet, OPERATOR_ADDRESS, transferAmount);

        console.log(`----------------------------------------------------------------------------`);

        [transferAmount, l1feeAccountBalance] = await calculateTransferAmount(
            l1feeAccountBalance,
            blobOperatorBalance,
            UPPER_BOUND_BLOB_OPERATOR_THRESHOLD,
            LOWER_BOUND_BLOB_OPERATOR_THRESHOLD,
            L1_ETH_TRANSFER_THRESHOLD
        );
        console.log(
            `Amount which fee account can send to blob operator: ${ethers.utils.formatEther(transferAmount)} ETH;
            fee account l1 balance in this case will be ${ethers.utils.formatEther(l1feeAccountBalance)} ETH`
        );

        console.log('Step 5 - send ETH to blob operator');
        await sendETH(ethWallet, BLOB_OPERATOR_ADDRESS, transferAmount);

        console.log(`----------------------------------------------------------------------------`);

        [transferAmount, l1feeAccountBalance] = await calculateTransferAmount(
            l1feeAccountBalance,
            withdrawerBalance,
            UPPER_BOUND_WITHDRAWER_THRESHOLD,
            LOWER_BOUND_WITHDRAWER_THRESHOLD,
            L1_ETH_TRANSFER_THRESHOLD
        );
        console.log(
            `Amount which fee account can send to withdrawer: ${ethers.utils.formatEther(transferAmount)} ETH;
            fee account l1 balance in this case will be ${ethers.utils.formatEther(l1feeAccountBalance)} ETH`
        );

        console.log('Step 6 - send ETH to withdrawal finalizer');
        await sendETH(ethWallet, WITHDRAWAL_FINALIZER_ETH_ADDRESS, transferAmount);

        console.log(`----------------------------------------------------------------------------`);

        transferAmount = maxBigNumber(l1feeAccountBalance.sub(L1_ETH_TRANSFER_THRESHOLD), BigNumber.from(0));
        console.log(
            `Amount which fee account can send to reserve accumulator: ${ethers.utils.formatEther(transferAmount)} ETH;
            fee account l1 balance in this case will be ${ethers.utils.formatEther(L1_ETH_TRANSFER_THRESHOLD)} ETH`
        );
        console.log('Step 7 - send ETH to reserve address');
        await sendETH(ethWallet, RESERVE_FEE_ACCUMULATOR_ADDRESS, transferAmount);
    } catch (e) {
        console.error('Failed to proceed with fee withdrawal: ', e);
        process.exit(1);
    }
})();
