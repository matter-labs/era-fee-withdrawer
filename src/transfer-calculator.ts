import { BigNumber, utils } from 'ethers';
import { maxBigNumber, minBigNumber } from './utils';

export function calculateTransferAmount(
    feeWalletBalance: BigNumber, // sender
    receiverBalance: BigNumber,
    upperBoundThreshold: BigNumber,
    lowerBoundThreshold: BigNumber,
    transferThreshold: BigNumber
): BigNumber[] {
    console.log(`current fee account balance is ${utils.formatEther(feeWalletBalance)} ETH`);

    let allowedEth = maxBigNumber(feeWalletBalance.sub(transferThreshold), BigNumber.from(0));
    let amountToTransfer = BigNumber.from(0);
    if (allowedEth.gt(0) && receiverBalance.lt(lowerBoundThreshold)) {
        console.log(`Calculating transfer amount`);
        let maxAmountNeeded = upperBoundThreshold.sub(receiverBalance);
        amountToTransfer = minBigNumber(allowedEth, maxAmountNeeded); // Min
        feeWalletBalance = feeWalletBalance.sub(amountToTransfer);
    }
    return [amountToTransfer, feeWalletBalance];
}
