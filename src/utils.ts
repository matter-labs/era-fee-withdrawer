import { BigNumber, BigNumberish, Contract, ethers, utils } from 'ethers';
import Axios from 'axios';

export function numberAsFractionInBIPs(number: BigNumberish, baseFraction: BigNumberish): BigNumber {
    const base = BigNumber.from(baseFraction);
    if (base.eq(0)) {
        throw new Error("Base fraction can't be 0");
    }
    const num = BigNumber.from(number);
    if (num.lt(0) || base.lt(0)) {
        throw new Error('Numbers should be non-negative');
    }
    return num.mul(10000).div(base);
}

export function isOperationFeeAcceptable(amount: BigNumberish, fee: BigNumberish, operationFeeThreshold: number): boolean {
    amount = BigNumber.from(amount);
    fee = BigNumber.from(fee);

    if (amount.eq(0)) {
        return false;
    }

    if (amount.lte(fee)) {
        return false;
    }

    return numberAsFractionInBIPs(fee, amount).lte(operationFeeThreshold * 100);
}

export async function sendNotification(text: string, webhookUrl: string) {
    try {
        await Axios.post(webhookUrl, {
            username: 'fee_seller_bot',
            text
        });
    } catch (e) {
        console.error('Failed to send notification: ', e.toString());
    }
}

export function minBigNumber(a: ethers.BigNumber, b: ethers.BigNumber): ethers.BigNumber {
    if (a.lt(b)) {
        return a;
    } else {
        return b;
    }
}
