import { BigNumber } from 'ethers';
import { expect } from 'chai'
import { TransferCalculator } from '../src/transfer-calculator'


describe('Transfer calculator', function () {
    it('Calculate transfers in different ways', function () {
        const lowerOperatorThreshold = BigNumber.from(10);
        const lowerWithdrawerThreshold = BigNumber.from(20);
        const lowerPaymasterThreshold = BigNumber.from(30);
        const upperOperatorThreshold = BigNumber.from(11);
        const upperWithdrawerThreshold = BigNumber.from(22);
        const upperPaymasterThreshold = BigNumber.from(33);
        const l1EthTransferThreshold = BigNumber.from(1);
        const l2EthTransferThreshold = BigNumber.from(2);

        const paymasterCalculator = new TransferCalculator(upperPaymasterThreshold, lowerPaymasterThreshold, l2EthTransferThreshold);
        const operatorCalculator = new TransferCalculator(upperOperatorThreshold, lowerOperatorThreshold, l1EthTransferThreshold);
        const withdrawerCalculator = new TransferCalculator(upperWithdrawerThreshold, lowerWithdrawerThreshold, l1EthTransferThreshold);
        const reserveCalculator = new TransferCalculator(BigNumber.from(Number.MAX_SAFE_INTEGER), BigNumber.from(0), l1EthTransferThreshold);

         // All accounts has enough balance send everything to reserve account 
        
        // Enough money to split by accounts 

        // Do not send funds to paymaster on mainnet 
        
        // Send all money to paymaster
        
        // Send money to paymaster and operator

    })
})
