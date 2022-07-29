import { BigNumber, BigNumberish } from 'ethers';

export class AccountTransferAmounts {
    toOperatorAmount: BigNumber;
    toWithdrawalFinalizerAmount: BigNumber;
    toAccumulatorAmount: BigNumber;
}

export class TransferCalculator {
    constructor(
        public lowerBoundOperatorThreshold: BigNumber,
        public upperBoundOperatorThreshold: BigNumber,
        public lowerBoundWithdrawerThreshold: BigNumber,
        public upperBoundWithdrawerThreshold: BigNumber,
        public ethTransferThreshold: BigNumber
    ) {}

    /// Calculate how much ETH we have to send to Operator, Withdraw Finalizer, Reserve Accumulator.
    /// Based on required thresholds and available eth.
    calculateTransferAmounts(allowedEth: BigNumber, operatorBalance: BigNumber, withdrawerBalance: BigNumber): AccountTransferAmounts {
        let toOperatorAmount = BigNumber.from(0);
        let toWithdrawalFinalizerAmount = BigNumber.from(0);

        // Sub threshold amount from the fee account. We have to have some Treshhold on fee account for paying L1 fees.
        allowedEth = allowedEth.sub(this.ethTransferThreshold);

        // Calculate the transfer amount for operator.
        if (allowedEth.gt(0) && operatorBalance.lt(this.lowerBoundOperatorThreshold)) {
            let maxAmountNeeded = this.upperBoundOperatorThreshold.sub(operatorBalance);
            toOperatorAmount = maxAmountNeeded.gt(allowedEth) ? allowedEth : maxAmountNeeded; // Min
            allowedEth = allowedEth.sub(toOperatorAmount);
        }
        // Calculate the transfer amount for withdrawer.
        if (allowedEth.gt(0) && withdrawerBalance.lt(this.lowerBoundWithdrawerThreshold)) {
            let maxAmountNeeded = this.upperBoundWithdrawerThreshold.sub(withdrawerBalance);
            toWithdrawalFinalizerAmount = maxAmountNeeded.gt(allowedEth) ? allowedEth : maxAmountNeeded; // Min
            allowedEth = allowedEth.sub(toWithdrawalFinalizerAmount);
        }

        // The rest of amount we have to send to reserve address.
        return { toOperatorAmount, toWithdrawalFinalizerAmount, toAccumulatorAmount: allowedEth };
    }
}
