import * as ethers from 'ethers';
import * as zkweb3 from 'zksync-web3';
import { BigNumber } from 'ethers';
import { isOperationFeeAcceptable, minBigNumber, maxBigNumber } from './utils';
import { TransferCalculator } from './transfer-calculator';

/** Env parameters */
/** L2 fee account PK */
const FEE_ACCOUNT_PRIVATE_KEY = process.env.MISC_FEE_ACCOUNT_PRIVATE_KEY;

/** Addresses of accounts to distribute ETH among */
const OPERATOR_ADDRESS = process.env.OPERATOR_ADDRESS;
const WITHDRAWAL_FINALIZER_ETH_ADDRESS = process.env.WITHDRAWAL_FINALIZER_ETH_ADDRESS;
const RESERVE_FEE_ACCUMULATOR_ADDRESS = process.env.MISC_RESERVE_FEE_ACCUMULATOR_ADDRESS;
const TESTNET_PAYMASTER_ADDRESS = process.env.CONTRACTS_L2_TESTNET_PAYMASTER_ADDR;

/** API URLs */
export const L1_WEB3_API_URL = process.env.L1_RPC_ADDRESS;
export const ZKSYNC_WEB3_API_URL = process.env.ZKSYNC_WEB3_API_URL;

/** Thresholds */
const MAX_LIQUIDATION_FEE_PERCENT = parseInt(process.env.MISC_MAX_LIQUIDATION_FEE_PERCENT);

const LOWER_BOUND_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_OPERATOR_THRESHOLD);
const UPPER_BOUND_OPERATOR_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_OPERATOR_THRESHOLD);

const LOWER_BOUND_WITHDRAWER_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_WITHDRAWER_THRESHOLD);
const UPPER_BOUND_WITHDRAWER_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_WITHDRAWER_THRESHOLD);

const LOWER_BOUND_PAYMASTER_THRESHOLD = ethers.utils.parseEther(process.env.LOWER_BOUND_PAYMASTER_THRESHOLD);
const UPPER_BOUND_PAYMASTER_THRESHOLD = ethers.utils.parseEther(process.env.UPPER_BOUND_PAYMASTER_THRESHOLD);

const L1_ETH_TRANSFER_THRESHOLD = process.env.L1_ETH_TRANSFER_THRESHOLD
    ? ethers.utils.parseEther(process.env.L1_ETH_TRANSFER_THRESHOLD)
    : ethers.utils.parseEther('3.0');

const L2_ETH_TRANSFER_THRESHOLD = process.env.L2_ETH_TRANSFER_THRESHOLD
    ? ethers.utils.parseEther(process.env.L2_ETH_TRANSFER_THRESHOLD)
    : ethers.utils.parseEther('1.0');

async function withdraw(wallet: zkweb3.Wallet) {
    let amount = await wallet.getBalance(zkweb3.utils.ETH_ADDRESS);
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

async function topUpPaymaster(wallet: zkweb3.Wallet, amount: BigNumber) {
    // Estimate withdrawal fee.
    const tx = await wallet.provider.getTransferTx({
        token: zkweb3.utils.ETH_ADDRESS,
        amount,
        from: wallet.address,
        to: TESTNET_PAYMASTER_ADDRESS
    });
    const gasLimit = (await wallet.provider.estimateGas(tx)).mul(2);
    const gasPrice = await wallet.provider.getGasPrice();
    const fee = gasLimit.mul(gasPrice);
    if (isOperationFeeAcceptable(amount, fee, MAX_LIQUIDATION_FEE_PERCENT)) {
        const transferHandle = await wallet.transfer({
            token: zkweb3.utils.ETH_ADDRESS,
            amount,
            to: TESTNET_PAYMASTER_ADDRESS,
            overrides: {
                gasPrice,
                gasLimit
            }
        });
        const hash = transferHandle.hash;
        console.log(
            `ETH transfer to paymaster, amount: ${ethers.utils.formatEther(amount)}, fee: ${ethers.utils.formatEther(
                fee
            )}, tx hash: ${hash}`
        );

        await transferHandle.wait();
        console.log(`Transfer to paymaster has succeeded, tx hash: ${hash}`);
    } else {
        console.log('Skipping transfering, fee slippage is too big');
    }
}

async function retryL1Tx(initialGasPrice, ethProvider, sendTransaction: (gasPrice) => Promise<void>) {
    const MAX_TRIES = 5;
    const GAS_PRICE_INCREASE_PERCENT = 20;

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
    const gasPrice = await ethWallet.provider.getGasPrice();
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
            await tx.wait();

            console.log(`Transfer has succeded, tx hash: ${tx.hash}`);
        });
    } else {
        console.log(
            `Skipping transfer because fee/amount ratio is too high: fee ${ethTransferFee.toString()}, amount ${amount.toString()}`
        );
    }
}

async function depositETH(zkWallet: zkweb3.Wallet, to: string, amount: BigNumber) {
    const l1GasPrice = await zkWallet.ethWallet().provider.getGasPrice();
    const l1GasLimit = BigNumber.from(zkweb3.utils.RECOMMENDED_GAS_LIMIT.DEPOSIT);
    // Note, that right now, the base fee for deposits is 0. Maybe in the future,
    // this will change and it will require updating this part as well.
    const baseFee = BigNumber.from(0);

    const totalFee = l1GasLimit.mul(l1GasPrice).add(baseFee);
    const balance = await zkWallet.ethWallet().getBalance();

    // We can not spend more than the balance of the account
    amount = minBigNumber(amount, balance.sub(totalFee));

    if (isOperationFeeAcceptable(amount, totalFee, MAX_LIQUIDATION_FEE_PERCENT)) {
        await retryL1Tx(l1GasPrice, zkWallet.ethWallet().provider, async (l1GasPrice) => {
            const tx = await zkWallet.deposit({
                token: zkweb3.utils.ETH_ADDRESS,
                amount,
                to,
                overrides: {
                    gasLimit: l1GasLimit,
                    gasPrice: l1GasPrice,
                    value: amount.add(baseFee)
                }
            });
            console.log(`Depositing ${ethers.utils.formatEther(amount)} ETH to ${to}, tx hash: ${tx.hash}`);
            await tx.wait();

            console.log(`Deposit has succeded, tx hash: ${tx.hash}`);
        });
    } else {
        console.log(`Skipping deposit because fee/amount ratio is too high: fee ${totalFee.toString()}, amount ${amount.toString()}`);
    }
}

(async () => {
    const ethProvider = new ethers.providers.JsonRpcProvider(L1_WEB3_API_URL);
    const zksyncProvider = new zkweb3.Provider(ZKSYNC_WEB3_API_URL);
    const wallet = new zkweb3.Wallet(FEE_ACCOUNT_PRIVATE_KEY, zksyncProvider, ethProvider);
    const ethWallet = new ethers.Wallet(FEE_ACCOUNT_PRIVATE_KEY, ethProvider);
    let paymasterTransferCalculator = new TransferCalculator(
        UPPER_BOUND_PAYMASTER_THRESHOLD,
        LOWER_BOUND_PAYMASTER_THRESHOLD,
        L2_ETH_TRANSFER_THRESHOLD
    );
    let operatorTransferCalculator = new TransferCalculator(
        UPPER_BOUND_OPERATOR_THRESHOLD,
        LOWER_BOUND_OPERATOR_THRESHOLD,
        L1_ETH_TRANSFER_THRESHOLD
    );
    let withdrawerTransferCalculator = new TransferCalculator(
        UPPER_BOUND_WITHDRAWER_THRESHOLD,
        LOWER_BOUND_WITHDRAWER_THRESHOLD,
        L1_ETH_TRANSFER_THRESHOLD
    );
    let reserveTransferCalculator = new TransferCalculator(
        BigNumber.from(Number.MAX_SAFE_INTEGER),
        BigNumber.from(0),
        L1_ETH_TRANSFER_THRESHOLD
    );

    try {
        const isMainnet = (await ethProvider.getNetwork()).chainId == 1;
        if (TESTNET_PAYMASTER_ADDRESS && isMainnet) {
            throw new Error('Testnet paymaster should not be present on mainnet deployments');
        }

        let l1feeAccountBalance = await ethProvider.getBalance(wallet.address);
        console.log(`Fee account L1 balance before top-up: ${ethers.utils.formatEther(l1feeAccountBalance)}`);

        const l2feeAccountBalance = await zksyncProvider.getBalance(wallet.address);
        console.log(`Fee account L2 balance before top-up: ${ethers.utils.formatEther(l2feeAccountBalance)}`);

        const operatorBalance = await ethProvider.getBalance(OPERATOR_ADDRESS);
        console.log(`Operator L1 balance before top-up: ${ethers.utils.formatEther(operatorBalance)}`);

        const withdrawerBalance = await ethProvider.getBalance(WITHDRAWAL_FINALIZER_ETH_ADDRESS);
        console.log(`Withdrawer L1 balance before top-up: ${ethers.utils.formatEther(withdrawerBalance)}`);

        const paymasterL2Balance = TESTNET_PAYMASTER_ADDRESS
            ? await zksyncProvider.getBalance(TESTNET_PAYMASTER_ADDRESS)
            : BigNumber.from(0);
        console.log(`Paymaster L2 balance before top-up: ${ethers.utils.formatEther(paymasterL2Balance)}`);

        let transferAmount = await paymasterTransferCalculator.calculateTransferAmount(wallet, paymasterL2Balance);
        console.log(`Amount which main wallet can send to paymaster: ${transferAmount}`);

        if (!TESTNET_PAYMASTER_ADDRESS) {
            console.log('Skipping step 1 -- send ETH to paymaster');
        } else {
            console.log('Step 1 - send ETH to paymaster');
            await topUpPaymaster(wallet, transferAmount);
        }

        console.log('Step 2 - withdrawing tokens from ZkSync');
        await withdraw(wallet);

        l1feeAccountBalance = await ethProvider.getBalance(wallet.address);
        console.log(`L1 fee account balance after withdraw: ${ethers.utils.formatEther(l1feeAccountBalance)}`);

        let l1TransferAmount = await operatorTransferCalculator.calculateTransferAmount(wallet, operatorBalance);
        console.log(`Amount which main wallet can send to operator: ${l1TransferAmount}`);

        console.log('Step 3 - send ETH to operator');
        await sendETH(ethWallet, OPERATOR_ADDRESS, l1TransferAmount);

        l1TransferAmount = await withdrawerTransferCalculator.calculateTransferAmount(wallet, withdrawerBalance);
        console.log(`Amount which main wallet can send to withdrawer: ${l1TransferAmount}`);

        console.log('Step 4 - send ETH to withdrawal finalizer');
        await sendETH(ethWallet, WITHDRAWAL_FINALIZER_ETH_ADDRESS, l1TransferAmount);

        l1TransferAmount = await reserveTransferCalculator.calculateTransferAmount(wallet, BigNumber.from(0));
        console.log(`Amount which main wallet can send to reserve: ${l1TransferAmount}`);

        console.log('Step 5 - send ETH to reserve address');
        await sendETH(ethWallet, RESERVE_FEE_ACCUMULATOR_ADDRESS, l1TransferAmount);
    } catch (e) {
        console.error('Failed to proceed with fee withdrawal: ', e);
        process.exit(1);
    }
})();
