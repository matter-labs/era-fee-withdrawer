import * as ethers from 'ethers';
import * as zkweb3 from 'zksync-web3';
import { BigNumber } from 'ethers';
import Axios from 'axios';
import { isOperationFeeAcceptable, minBigNumber, sendNotification } from './utils';
import { TransferCalculator } from './transfer-calculator';

/** Env parameters */

/** L2 fee account PK */
const FEE_ACCOUNT_PRIVATE_KEY = process.env.MISC_FEE_ACCOUNT_PRIVATE_KEY;

/** Addresses of accounts to distribute ETH among */
const OPERATOR_FEE_ETH_ADDRESS = process.env.CHAIN_STATE_KEEPER_FEE_ACCOUNT_ADDR;
const WITHDRAWAL_FINALIZER_ETH_ADDRESS = process.env.WITHDRAWAL_FINALIZER_ETH_ADDRESS;
const RESERVE_FEE_ACCUMULATOR_ADDRESS = process.env.MISC_RESERVE_FEE_ACCUMULATOR_ADDRESS;
const TESTNET_PAYMASTER_ADDRESS = process.env.CONTRACTS_L2_TESTNET_PAYMASTER_ADDR;

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

const ETH_TRANSFER_THRESHOLD = process.env.ETH_TRANSFER_THRESHOLD
    ? ethers.utils.parseEther(process.env.ETH_TRANSFER_THRESHOLD)
    : ethers.utils.parseEther('3.0');

/** Mattermost webhook url */
const NOTIFICATION_WEBHOOK_URL = process.env.NOTIFICATION_WEBHOOK_URL;

async function withdraw(wallet: zkweb3.Wallet) {
    const balance = await wallet.getBalance();
    // Estimate withdrawal fee.
    const tx = await wallet.provider.getWithdrawTx({
        token: zkweb3.utils.ETH_ADDRESS,
        amount: balance,
        from: wallet.address,
        to: wallet.address
    });
    const gasLimit = await wallet.provider.estimateGas(tx);
    const gasPrice = await wallet.provider.getGasPrice();
    const fee = gasLimit.mul(gasPrice);
    if (isOperationFeeAcceptable(balance, fee, MAX_LIQUIDATION_FEE_PERCENT)) {
        const amount = balance.sub(fee);

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

        await withdrawHandle.waitFinalize();
        console.log(`Withdrawal L2 tx has succeeded, tx hash: ${hash}`);

        // Wait for L1 finalizing.
        const intervalSec = 10;
        const timeoutSec = 3600;
        const maxRetries = timeoutSec / intervalSec;
        let finalized = false;
        for (let i = 0; i < maxRetries; ++i) {
            if (await wallet.isWithdrawalFinalized(hash)) {
                finalized = true;
                break;
            }
            await zkweb3.utils.sleep(intervalSec * 1000);
        }
        if (!finalized) {
            console.error(`Withdrawal has not been finalized, tx hash: ${hash}`);
            process.exit(1);
        }
        console.log(`Withdrawal has been finalized, tx hash: ${hash}`);
        await sendNotification(`Withdrawn ${ethers.utils.formatEther(amount)} ETH to L1`, NOTIFICATION_WEBHOOK_URL);
    } else {
        console.log('Skipping withdrawing, fee slippage is too big');
    }
}

async function sendETH(ethWallet: ethers.Wallet, to: string, amount: BigNumber) {
    const gasPrice = await ethWallet.provider.getGasPrice();
    const ethTransferFee = BigNumber.from('21000').mul(gasPrice);
    const balance = await ethWallet.getBalance();

    // We can not spend more than the balance of the account
    amount = minBigNumber(amount, balance.sub(ethTransferFee));

    if (isOperationFeeAcceptable(amount, ethTransferFee, MAX_LIQUIDATION_FEE_PERCENT)) {
        const tx = await ethWallet.sendTransaction({
            to,
            value: amount,
            gasPrice
        });
        console.log(`Sending ${ethers.utils.formatEther(amount)} ETH to ${to}, tx hash: ${tx.hash}`);
        await tx.wait();

        console.log(`Transfer has succeded, tx hash: ${tx.hash}`);
        await sendNotification(`Sent ${ethers.utils.formatEther(amount)} ETH to ${to}, tx hash: ${tx.hash}`, NOTIFICATION_WEBHOOK_URL);
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
        await sendNotification(`Deposited ${ethers.utils.formatEther(amount)} ETH to ${to}, tx hash: ${tx.hash}`, NOTIFICATION_WEBHOOK_URL);
    }
}

(async () => {
    const ethProvider = new ethers.providers.JsonRpcProvider(L1_WEB3_API_URL);
    const zksyncProvider = new zkweb3.Provider(ZKSYNC_WEB3_API_URL);
    const wallet = new zkweb3.Wallet(FEE_ACCOUNT_PRIVATE_KEY, zksyncProvider, ethProvider);
    const ethWallet = new ethers.Wallet(FEE_ACCOUNT_PRIVATE_KEY, ethProvider);
    const calculator = new TransferCalculator(
        LOWER_BOUND_OPERATOR_THRESHOLD,
        UPPER_BOUND_OPERATOR_THRESHOLD,
        LOWER_BOUND_WITHDRAWER_THRESHOLD,
        UPPER_BOUND_WITHDRAWER_THRESHOLD,
        LOWER_BOUND_PAYMASTER_THRESHOLD,
        UPPER_BOUND_PAYMASTER_THRESHOLD,
        ETH_TRANSFER_THRESHOLD
    );

    try {
        const isMainnet = (await ethProvider.getNetwork()).chainId == 1;
        if (TESTNET_PAYMASTER_ADDRESS && isMainnet) {
            throw new Error('Testnet paymaster should not be present on mainnet deployments');
        }

        console.log('Step 1 - withdrawing tokens from ZkSync');
        await withdraw(wallet);

        const feeAccountBalance = await ethProvider.getBalance(wallet.address);
        const operatorBalance = await ethProvider.getBalance(OPERATOR_FEE_ETH_ADDRESS);
        const withdrawerBalance = await ethProvider.getBalance(WITHDRAWAL_FINALIZER_ETH_ADDRESS);
        const paymasterL2Balance = TESTNET_PAYMASTER_ADDRESS
            ? await zksyncProvider.getBalance(TESTNET_PAYMASTER_ADDRESS)
            : BigNumber.from(0);
        const transferAmounts = calculator.calculateTransferAmounts(
            feeAccountBalance,
            operatorBalance,
            withdrawerBalance,
            paymasterL2Balance,
            isMainnet
        );

        console.log('Step 2 - send ETH to operator');
        await sendETH(ethWallet, OPERATOR_FEE_ETH_ADDRESS, transferAmounts.toOperatorAmount);

        console.log('Step 3 - send ETH to withdrawal finalizer');
        await sendETH(ethWallet, WITHDRAWAL_FINALIZER_ETH_ADDRESS, transferAmounts.toWithdrawalFinalizerAmount);

        console.log('Step 4 - send ETH to reserve address');
        await sendETH(ethWallet, RESERVE_FEE_ACCUMULATOR_ADDRESS, transferAmounts.toAccumulatorAmount);

        if (!TESTNET_PAYMASTER_ADDRESS) {
            console.log('Skipping step 5 -- send ETH to paymaster');
        } else {
            console.log('Step 5 - send ETH to paymaster');
            await depositETH(wallet, TESTNET_PAYMASTER_ADDRESS, transferAmounts.toTestnetPaymasterAmount);
        }
    } catch (e) {
        console.error('Failed to proceed with fee withdrawal: ', e);
        process.exit(1);
    }
})();
