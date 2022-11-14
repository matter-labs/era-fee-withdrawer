import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { calculateTransferAmount } from '../src/transfer-calculator';

describe('Transfer calculator tests', function () {
    // to test `calculateTransferAmount()` some thresholds are needed
    // as an sample paymaster is used here
    const lowerPaymasterThreshold = BigNumber.from(30);
    const upperPaymasterThreshold = BigNumber.from(33);
    const l2EthFeeThreshold = BigNumber.from(4);

    it('Should calculate upper threshold ETH amount', function () {
        let initialL2FeeAccountBalance = BigNumber.from(100);
        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(33));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(67));
    });

    it('Should calculate 0: insufficient `fee account` ETH amount', function () {
        let initialL2FeeAccountBalance = BigNumber.from(4);
        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(4));
    });

    it('Should calculate 0: reached lower ETH threshold', function () {
        let initialL2FeeAccountBalance = BigNumber.from(4);
        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(30),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(4));
    });

    it('Should calculate small ETH amount', function () {
        let initialL2FeeAccountBalance = BigNumber.from(5);
        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(1));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(4));
    });
});
