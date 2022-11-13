import { BigNumber, BigNumberish, ethers, utils } from 'ethers';
import { maxBigNumber } from './utils';
import * as zksync from 'zksync-web3';
export class TransferCalculator {
    constructor(
        public upperBoundThreshold: BigNumber,
        public lowerBoundThreshold: BigNumber,
        public transferThreshold: BigNumber
    ){}

    async calculateTransferAmount(feeWallet: zksync.Wallet | ethers.Wallet, currentBalance: BigNumber): Promise<BigNumber> {
        let curFeeWalletBalance = await feeWallet.getBalance();
        console.log(`current fee account balance is ${utils.formatEther(curFeeWalletBalance)} ETH`);

        let allowedEth = maxBigNumber(curFeeWalletBalance.sub(this.transferThreshold), BigNumber.from(0));
        console.log(`allowed eth to be send is ${utils.formatEther(curFeeWalletBalance)} ETH`);
        let amountToTransfer = BigNumber.from(0);
        if (allowedEth.gt(0) && currentBalance.lt(this.lowerBoundThreshold)) {
            console.log(`Calculating transfer amount`);
            let maxAmountNeeded = this.upperBoundThreshold.sub(currentBalance);
            amountToTransfer = maxAmountNeeded.gt(allowedEth) ? allowedEth : maxAmountNeeded; // Min
        }
        return amountToTransfer;
    }
}
