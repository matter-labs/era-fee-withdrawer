import { BigNumber, utils } from 'ethers';
import { expect } from 'chai'
import { TransferCalculator } from '../src/transfer-calculator'


describe('Transfer calculator', function () {
    it('Calculate transfers', function () {
        const lowerOperatorThreshold = BigNumber.from(10);
        const lowerWithdrawerThreshold = BigNumber.from(20);
        const lowerPaymasterThreshold = BigNumber.from(30);
        const upperOperatorThreshold = BigNumber.from(11);
        const upperWithdrawerThreshold = BigNumber.from(22);
        const upperPaymasterThreshold = BigNumber.from(33);
        const feeSellerThreshold = BigNumber.from(3);

        const calculator = new TransferCalculator(lowerOperatorThreshold, upperOperatorThreshold,
            lowerWithdrawerThreshold, upperWithdrawerThreshold, lowerPaymasterThreshold, upperPaymasterThreshold, feeSellerThreshold);
        // All accounts has enough balance send everything to reserve account 
        let balances = calculator.calculateTransferAmounts(BigNumber.from(100), lowerOperatorThreshold, lowerWithdrawerThreshold, lowerPaymasterThreshold, false);
        expect(balances.toOperatorAmount.toNumber()).eq(0);
        expect(balances.toWithdrawalFinalizerAmount.toNumber()).eq(0);
        expect(balances.toTestnetPaymasterAmount.toNumber()).eq(0);
        expect(balances.toAccumulatorAmount.toNumber()).eq(97);
        
        // Enough money to split by accounts 
        balances = calculator.calculateTransferAmounts(BigNumber.from(100), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4), false);
        expect(balances.toOperatorAmount.toNumber()).eq(9);
        expect(balances.toWithdrawalFinalizerAmount.toNumber()).eq(19);
        expect(balances.toTestnetPaymasterAmount.toNumber()).eq(29);
        expect(balances.toAccumulatorAmount.toNumber()).eq(40);

        // Do not send funds to paymaster on mainnet 
        balances = calculator.calculateTransferAmounts(BigNumber.from(100), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4), true);
        expect(balances.toOperatorAmount.toNumber()).eq(9);
        expect(balances.toWithdrawalFinalizerAmount.toNumber()).eq(19);
        expect(balances.toTestnetPaymasterAmount.toNumber()).eq(0);
        expect(balances.toAccumulatorAmount.toNumber()).eq(69);
        
        // Send all money to operator
        balances = calculator.calculateTransferAmounts(BigNumber.from(11), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4), false);
        expect(balances.toOperatorAmount.toNumber()).eq(8);
        expect(balances.toWithdrawalFinalizerAmount.toNumber()).eq(0);
        expect(balances.toTestnetPaymasterAmount.toNumber()).eq(0);
        expect(balances.toAccumulatorAmount.toNumber()).eq(0);
        
        // Send money to operator and withdrawer
        balances = calculator.calculateTransferAmounts(BigNumber.from(15), BigNumber.from(2), BigNumber.from(3), BigNumber.from(5), false);
        expect(balances.toOperatorAmount.toNumber()).eq(9);
        expect(balances.toWithdrawalFinalizerAmount.toNumber()).eq(3);
        expect(balances.toAccumulatorAmount.toNumber()).eq(0);
    })
})
