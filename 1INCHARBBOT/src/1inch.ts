import axios from 'axios';
import { Provider, toHex } from './helpers';
import { Quote, Swap, Failure, Approve, Protocols } from './types/1inch';
import { ethers, Wallet } from 'ethers'
const fakeUa = require('fake-useragent');



if (!process.env.PRIVATE_KEY) {
    throw "PRIVATE_KEY Must be in your .env File"
}
const NETWORK = process.env.NETWORK || '1'
export class OneInch extends Provider {
    readonly account: Wallet
    constructor() {
        super()
        this.account = new Wallet(process.env.PRIVATE_KEY!, this.provider);
    }
    getQuote = async (params: {
        fromToken: string,
        toToken: string,
        amount: string
    }): Promise<Quote> => {

        const { data } = await axios({
            method: 'GET',
            url: `https://api.1inch.exchange/v3.0/${NETWORK}/quote?fromTokenAddress=${params.fromToken}&toTokenAddress=${params.toToken}&amount=${params.amount}`
        })

        return data
    }
    swap = async (params: {
        fromToken: string,
        toToken: string,
        amount: string,
        slippage: string,
        nonce: number,
        protocols?: string,
        gasPrice?: string,
        gasLimit?: string,
    }): Promise<Swap> => {
        try {
            const { data } = await axios({
                method: "GET",
                url: `https://api.1inch.exchange/v3.0/${NETWORK}/swap?fromTokenAddress=${params.fromToken}&toTokenAddress=${params.toToken}&amount=${params.amount}&fromAddress=${process.env.PUBLIC_KEY}&disableEstimate=true&slippage=${params.slippage}`
            })

            try {
                delete data.tx.gasPrice;
                delete data.tx.gas;

                if (params.gasLimit) {
                    data.tx.gasLimit = toHex(parseInt(params.gasLimit))
                }

                data.tx.nonce = params.nonce
                data.tx["value"] = toHex(parseInt(data.tx["value"]))


                await this.account.sendTransaction(data.tx).then(
                    async (tx: any) => {
                        data['gasLimit'] = parseInt(tx['gasLimit'].toString())
                        data['hash'] = tx['hash']
                    }
                );
                console.log("Transaction success");

                return data


            } catch (error) {
                // console.log(JSON.stringify(error));
                console.log('Retrying ... ')
                if (JSON.stringify(error).includes("nonce has already been used")) {
                    params.nonce += 1
                    return this.swap(params)
                }
                throw new Error(`${JSON.parse(JSON.stringify(error))}`)
            }
        } catch (error) {
            // console.log(JSON.stringify(error));
            console.log('Retrying ... ')
            if (JSON.stringify(error).includes("nonce has already been used")) {
                params.nonce += 1
                return this.swap(params)
            }
            throw new Error(`${JSON.parse(JSON.stringify(error))}`)
        }


    }


    approve = async (params: {
        token: string,
        amount?: string,
        infinity?: boolean,
        nonce: number
    }): Promise<Approve> => {
        const { data } = await axios({
            method: "GET",
            url: `https://api.1inch.exchange/v3.0/${NETWORK}/approve/calldata?infinity=${params.infinity}&tokenAddress=${params.token}`,
            headers: {
                'User-Agent': fakeUa()
            }
        })
        try {
            // console.log(data);
            delete data.gasPrice;
            delete data.gas;

            data.value = toHex(parseInt(data.value))
            if (!isNaN(params.nonce)) {
                data.nonce = params.nonce
            }


            await this.account.sendTransaction(data).then(
                async (tx: any) => {                                 //catch any errors
                    data['success'] = true
                    data['hash'] = tx['hash']

                }
            );                                              //send the transaction
            console.log("Approval success");
        } catch (e) {
            console.log('Retrying ... ')
            if (JSON.stringify(e).includes("nonce has already been used")) {
                params.nonce += 1
                return this.approve(params)
            }
            throw new Error(`Approval failure ${e}`);
        }
        return data
    }
    getProtocols = async (): Promise<Protocols> => {
        const { data } = await axios({
            method: "GET",
            url: `https://api.1inch.exchange/v3.0/${NETWORK}/protocols`
        })
        return data
    }
    /**
   * Returns the amount of tokens owned by `account`.
   */
    balanceOf = async (tokenAddress: string, address: string = process.env.PUBLIC_KEY!) => {
        let contract = new ethers.Contract(
            tokenAddress,
            ['function balanceOf(address account) external view returns (uint256)'],
            this.account
        )
        return await contract.balanceOf(address);

    }

    getNonce = async () => {
        return await this.provider.getTransactionCount(process.env.PUBLIC_KEY!)
    }
}