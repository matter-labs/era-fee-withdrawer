import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { calculateTransferAmount } from '../src/transfer-calculator';

function mockWithdraw(curL2Balance: BigNumber, curL1Balance: BigNumber, l2EthFeeThreshold: BigNumber): BigNumber {
    return curL2Balance.add(curL1Balance).sub(l2EthFeeThreshold);
}

describe('Transfer calculator tests', function () {
    const lowerOperatorThreshold = BigNumber.from(10);
    const upperOperatorThreshold = BigNumber.from(11);
    const lowerWithdrawerThreshold = BigNumber.from(20);
    const upperWithdrawerThreshold = BigNumber.from(22);
    const lowerPaymasterThreshold = BigNumber.from(30);
    const upperPaymasterThreshold = BigNumber.from(33);
    const l2EthFeeThreshold = BigNumber.from(4);
    const l1EthFeeThreshold = BigNumber.from(10);

    it('All accounts should be topped up', function () {
        let initialL1FeeAccountBalance = BigNumber.from(20);
        let initialL2FeeAccountBalance = BigNumber.from(100);

        // All accounts has enough balance send everything to reserve account
        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(33));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(67));

        let newL1FeeAccountBalance = mockWithdraw(feeL2RemainingBalance, initialL1FeeAccountBalance, l2EthFeeThreshold);
        expect(newL1FeeAccountBalance).to.deep.eq(BigNumber.from(20 + 67 - 4));

        let feeL1RemainingBalance;
        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            newL1FeeAccountBalance,
            BigNumber.from(0),
            upperOperatorThreshold,
            lowerOperatorThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(11));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(72));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            upperWithdrawerThreshold,
            lowerWithdrawerThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(22));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(50));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            BigNumber.from(Number.MAX_SAFE_INTEGER - 1),
            BigNumber.from(1),
            l1EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(40));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));
    });

    it('Only paymaster and operator accounts should be topped up', function () {
        let initialL1FeeAccountBalance = BigNumber.from(20);
        let initialL2FeeAccountBalance = BigNumber.from(4 + 33 + 1);

        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(33));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(5));

        let newL1FeeAccountBalance = mockWithdraw(feeL2RemainingBalance, initialL1FeeAccountBalance, l2EthFeeThreshold);
        expect(newL1FeeAccountBalance).to.deep.eq(BigNumber.from(20 + 1));

        let feeL1RemainingBalance;
        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            newL1FeeAccountBalance,
            BigNumber.from(0),
            upperOperatorThreshold,
            lowerOperatorThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(11));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            upperWithdrawerThreshold,
            lowerWithdrawerThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            BigNumber.from(Number.MAX_SAFE_INTEGER - 1),
            BigNumber.from(1),
            l1EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));
    });

    it('Only paymaster account should be topped up', function () {
        let initialL1FeeAccountBalance = BigNumber.from(10);
        let initialL2FeeAccountBalance = BigNumber.from(4 + 33);

        let [transferAmount, feeL2RemainingBalance] = calculateTransferAmount(
            initialL2FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerPaymasterThreshold,
            l2EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(33));
        expect(feeL2RemainingBalance).to.deep.eq(BigNumber.from(4));

        let newL1FeeAccountBalance = mockWithdraw(feeL2RemainingBalance, initialL1FeeAccountBalance, l2EthFeeThreshold);
        expect(newL1FeeAccountBalance).to.deep.eq(BigNumber.from(10));

        let feeL1RemainingBalance;
        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            newL1FeeAccountBalance,
            BigNumber.from(0),
            upperOperatorThreshold,
            lowerOperatorThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            upperWithdrawerThreshold,
            lowerWithdrawerThreshold,
            l1EthFeeThreshold
        );

        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            feeL1RemainingBalance,
            BigNumber.from(0),
            BigNumber.from(Number.MAX_SAFE_INTEGER - 1),
            BigNumber.from(1),
            l1EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));
    });

    it('No account should be topped up', function () {
        let initialL1FeeAccountBalance = BigNumber.from(10);
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

        mockWithdraw(feeL2RemainingBalance, initialL1FeeAccountBalance, l2EthFeeThreshold);

        let feeL1RemainingBalance;
        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            initialL1FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerOperatorThreshold,
            l1EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));
    });

    it('Should top up not full paymaster amount', function () {
        let initialL1FeeAccountBalance = BigNumber.from(10);
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

        let feeL1RemainingBalance = mockWithdraw(feeL2RemainingBalance, initialL1FeeAccountBalance, l2EthFeeThreshold);

        [transferAmount, feeL1RemainingBalance] = calculateTransferAmount(
            initialL1FeeAccountBalance,
            BigNumber.from(0),
            upperPaymasterThreshold,
            lowerOperatorThreshold,
            l1EthFeeThreshold
        );
        expect(transferAmount).to.deep.eq(BigNumber.from(0));
        expect(feeL1RemainingBalance).to.deep.eq(BigNumber.from(10));
    });
});
