import { BigNumber, BigNumberish } from 'ethers';
import { maxBigNumber } from './utils';

export class TransferCalculator {
    constructor(public upperBoundThreshold: BigNumber, public lowerBoundThreshold: BigNumber, public transferThreshold: BigNumber) {}

    calculateTransferAmount(allowedEth: BigNumber, currentBalance: BigNumber): BigNumber[] {
        allowedEth = maxBigNumber(allowedEth.sub(this.transferThreshold), BigNumber.from(0));
        let amountToTransfer = BigNumber.from(0);
        if (allowedEth.gt(0) && currentBalance.lt(this.lowerBoundThreshold)) {
            let maxAmountNeeded = this.upperBoundThreshold.sub(currentBalance);
            amountToTransfer = maxAmountNeeded.gt(allowedEth) ? allowedEth : maxAmountNeeded; // Min
            allowedEth = allowedEth.sub(amountToTransfer).sub(this.transferThreshold);
        }
        return [amountToTransfer, allowedEth];
    }
}
