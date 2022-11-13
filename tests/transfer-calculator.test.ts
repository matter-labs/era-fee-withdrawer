import { BigNumber, utils, providers, Wallet as ethersWallet} from 'ethers';
import { expect } from 'chai'
import { TransferCalculator } from '../src/transfer-calculator'
import { ZKSYNC_WEB3_API_URL, L1_WEB3_API_URL } from '../src/index'
import { Wallet as zksyncWallet, Provider } from 'zksync-web3';

const TEST_FEE_ACCOUNT_PK = process.env.TEST_FEE_ACCOUNT_PK; 

describe('Transfer calculator', function () {
    let zksyncTestWallet: zksyncWallet;
    let ethersTestWallet: ethersWallet;
    before('initialize test wallet', async () => {
        const ethProvider = new providers.JsonRpcProvider(L1_WEB3_API_URL);
        const zksyncProvider = new Provider(ZKSYNC_WEB3_API_URL);
        ethersTestWallet = new ethersWallet(TEST_FEE_ACCOUNT_PK!, ethProvider);
        zksyncTestWallet = new zksyncWallet(TEST_FEE_ACCOUNT_PK!, zksyncProvider, ethProvider);
    });
    
    it('Calculate transfers in different ways', function () {
        const lowerOperatorThreshold = BigNumber.from(10);
        const lowerWithdrawerThreshold = BigNumber.from(20);
        const lowerPaymasterThreshold = BigNumber.from(30);
        const upperOperatorThreshold = BigNumber.from(11);
        const upperWithdrawerThreshold = BigNumber.from(22);
        const upperPaymasterThreshold = BigNumber.from(33);
        const l2EthTransferThreshold = BigNumber.from(2);
        const l1EthTransferThreshold = BigNumber.from(2);

        const paymasterCalculator = new TransferCalculator(upperPaymasterThreshold, lowerPaymasterThreshold, l2EthTransferThreshold);
        let transferAmount = paymasterCalculator.calculateTransferAmount(zksyncTestWallet, BigNumber.from(0));
        expect(transferAmount).to.deep.eq(BigNumber.from(33));
        
        const operatorCalculator = new TransferCalculator(upperOperatorThreshold, lowerOperatorThreshold, l1EthTransferThreshold);
        transferAmount = operatorCalculator.calculateTransferAmount(ethersTestWallet, BigNumber.from(0));
        expect(transferAmount).to.deep.eq(BigNumber.from(11));

        const withdrawerCalculator = new TransferCalculator(upperWithdrawerThreshold, lowerWithdrawerThreshold, l1EthTransferThreshold);
        transferAmount = withdrawerCalculator.calculateTransferAmount(ethersTestWallet, BigNumber.from(0));
        expect(transferAmount).to.deep.eq(BigNumber.from(22));
        
        const reserveCalculator = new TransferCalculator(BigNumber.from(Number.MAX_SAFE_INTEGER), BigNumber.from(0), l1EthTransferThreshold);
        transferAmount = reserveCalculator.calculateTransferAmount(ethersTestWallet, BigNumber.from(0));
 

        // All accounts has enough balance send everything to reserve account
        
        // paymasterCalculator.calculateTransferAmount(); 
        
        // Enough money to split by accounts 

        // Do not send funds to paymaster on mainnet 
        
        // Send all money to paymaster
        
        // Send money to paymaster and operator
    });

})

