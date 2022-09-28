import BigNumber from "bignumber.js";
import chalk from "chalk";
import { schedule } from "node-cron";
import { OneInch } from "./1inch"
import { flat, sendMessage } from "./helpers";
import { Protocol, Protocols, Quote, Swap, Token, UserToken } from "./types/1inch"
import { connect } from 'mongoose'
import { bot } from "./bot";
import { Trade, User, UserDoc } from "./models";
import { Direction } from "./enums/trade";
import { MONITORED_TOKENS } from "./data/tokens";
import { approve } from "./utils";
const chalkTable = require("chalk-table")

if (
    !process.env.BOT_TOKEN &&
    !process.env.DB_URL &&
    !process.env.SLIPPAGE &&
    !process.env.BUY_THRESHOLD &&
    !process.env.GAS_LIMIT &&
    !process.env.ETH_IN_AMOUNT &&
    !process.env.EXPLORER

) {
    throw new Error(
        "BOT_TOKEN && DB_URL && SLIPPAGE && GAS_LIMIT && BUY_THRESHOLD && ETH_IN_AMOUNT && EXPLORER,  Must be defined in your .env FILE"
    );
}

const PRICE_CHECK_INTERVAL = (process.env.PRICE_CHECK_INTERVAL || '3')
const BUY_THRESHOLD = parseFloat(process.env.BUY_THRESHOLD!)
const ETH_IN_AMOUNT = parseFloat(process.env.ETH_IN_AMOUNT!)

const Main = async () => {
    const oneInch = new OneInch()
    console.log('Starting...');
    console.log(`---`.repeat(10));

    try {
        bot.stop()
    }
    catch (err) {
    }

    console.log('Connecting to telegram bot...\n---');
    await bot.launch().then((result) => {
        console.log('Connected to telegram bot!');

    }).catch(async (err) => {
        let error = JSON.parse(JSON.stringify(err))
        console.log('Telegram Error:', error?.message);

    }).catch((error: any) => {
        console.log('Telegram error:', error);
    })

    console.log(`---`.repeat(10));
    console.log('Connecting to MongoDb...\n---');
    const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        keepAlive: true,
        connectTimeoutMS: 60000,
        socketTimeoutMS: 60000,
    }

    await connect(process.env.DB_URL!, options).then((result) => {
        console.log("Connected to MongoDb :)");
    }).catch(async (err) => {
        let error = JSON.parse(JSON.stringify(err))
        console.log('Mongo Error:', error?.name);
    });
    console.log(`---`.repeat(10));

    await oneInch.getProtocols()
        .then((protocols: Protocols) => {
            console.log(`Finding the best route for trade on the following exchanges ${protocols.protocols.join(', ')}...`);
        })
        .catch((err: any) => { })

    console.log(`---`.repeat(10));

    let ethAmount = new BigNumber(ETH_IN_AMOUNT).shiftedBy(18).toString()
    let message = ''
    let users = await User.find({ is_active: true })
    let cool_down_map: boolean = false
    schedule(`*/${PRICE_CHECK_INTERVAL} * * * * *`, async function () {
        console.log(`***`.repeat(10));
        MONITORED_TOKENS.forEach(async (token: UserToken) => {
            try {
                const buy_quote: Quote = await oneInch.getQuote({
                    fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                    toToken: token.address,
                    amount: ethAmount
                })
                let token_amount = buy_quote.toTokenAmount
                const sell_quote: Quote = await oneInch.getQuote({
                    fromToken: token.address,
                    toToken: buy_quote.fromToken.address,
                    amount: token_amount
                })

                const options = {
                    leftPad: 0,
                    columns: [
                        { field: "eth_in", name: chalk.cyan("ETH IN") },
                        { field: "buy_on_dex", name: chalk.green(`BEST BUY ROUTEs`) },
                        { field: "sell_on_dex", name: chalk.yellow("BEST SELL ROUTEs") },
                        { field: "token_amount", name: chalk.yellow("Token OUT") },
                        { field: "eth_out", name: chalk.yellow("ETH OUT") },
                        { field: "profit", name: chalk.yellow("PROFIT PCT") },
                        { field: "time", name: chalk.magenta("Time 📅") },
                        { field: "rate", name: chalk.blue("Fetch Rate 🕠") },
                    ]
                };
                const timestamp = new Date()
                let eth_out = parseFloat(new BigNumber(sell_quote.toTokenAmount).shiftedBy(-sell_quote.toToken.decimals).toFixed(6))
                const profit_pct = ((eth_out - ETH_IN_AMOUNT) / ETH_IN_AMOUNT) * 100
                let token_out = parseFloat(new BigNumber(token_amount).shiftedBy(-buy_quote.toToken.decimals).toFixed(6))
                let best_buy_protocols = (await flat(buy_quote.protocols)).map((quote: Protocol) => quote.name).join(',')
                let best_sell_protocols = (await flat(sell_quote.protocols)).map((quote: Protocol) => quote.name).join(',')
                const table = chalkTable(options, [
                    {
                        eth_in: ETH_IN_AMOUNT,
                        buy_on_dex: best_buy_protocols,
                        sell_on_dex: best_sell_protocols,
                        token_amount: `${token_out} ${buy_quote.toToken.symbol}`,
                        eth_out: `${eth_out} ${sell_quote.toToken.symbol}`,
                        profit: `${profit_pct.toFixed(6)}%`,
                        time: timestamp.toISOString().replace(/T/, ' ').replace(/\..+/, ''),
                        rate: `${PRICE_CHECK_INTERVAL}s`
                    },
                ]);
                if (profit_pct > 0 && !(JSON.stringify(best_buy_protocols) == JSON.stringify(best_sell_protocols))) {
                    console.log(table);
                }

                if (profit_pct >= BUY_THRESHOLD && !cool_down_map && !(JSON.stringify(best_buy_protocols) == JSON.stringify(best_sell_protocols))) {
                    let nonce: number = await oneInch.getNonce()

                    console.log(`Initiating a buy for token ${token.ticker} ...`);
                    cool_down_map = true
                    sendMessage(users, message)
                    oneInch.swap({
                        fromToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                        toToken: token.address,
                        amount: new BigNumber(process.env.ETH_IN_AMOUNT!).shiftedBy(18).toString(),
                        slippage: process.env.SLIPPAGE!,
                        protocols: best_buy_protocols,
                        gasLimit: process.env.GAS_LIMIT,
                        nonce: nonce
                    }).then(async (tx: Swap) => {
                        if (tx?.hash) {
                            // save the buy tx to db
                            new Trade({
                                fromToken: tx.fromToken,
                                toToken: tx.toToken,
                                toTokenAmount: new BigNumber(tx.toTokenAmount).shiftedBy(-tx.toToken.decimals).toString(),
                                fromTokenAmount: new BigNumber(tx.fromTokenAmount).shiftedBy(-tx.fromToken.decimals).toString(),
                                protocols: (await flat(tx.protocols)).map((quote: Protocol) => quote.name).join(', '),
                                estimatedGas: tx.estimatedGas,
                                tx: tx.tx,
                                direction: Direction.BUY,
                                gasLimit: tx.gasLimit,
                                hash: tx.hash,
                            }).save().then(async (doc: any) => {
                                // send to tg buy notification after saving
                                message = `*NEW TRADE NOTIFICATION*\n---`
                                message += `\n*Direction:* ${Direction.BUY}`
                                message += `\n*ETH Amount:* ${doc.fromTokenAmount}`
                                message += `\n*Token Amount:* ${doc.toTokenAmount}`
                                message += `\n*Token:* ${tx.toToken.name}`
                                message += `\n*Profit PCT:* ${profit_pct.toFixed(6)}%`
                                message += `\n*Dex:* ${doc.protocols}`
                                message += `\n*Gas Limit:* ${doc.gasLimit}`
                                message += `\n*Hash:* [${doc.hash.toUpperCase()}](${process.env.EXPLORER!}${doc.hash})`

                                sendMessage(users, message)

                            }).catch(async (err: any) => {
                                cool_down_map = false
                                let error = JSON.parse(JSON.stringify(err))?.response?.data?.message ? JSON.parse(JSON.stringify(err))?.data?.message : err
                                if (!error) {
                                    error = err
                                }
                                console.error(error)
                                message = `*TRADE TRANSACTION FAILED*\n---`
                                message += `\n*Action:* ${Direction.BUY}`
                                message += `\n*Token:* ${tx.toToken.name}`
                                message += `\n*Error:* ${error}`
                                message += `\n---`
                                sendMessage(users, message)

                            })


                            try {
                                await approve(token)
                                // initiate a sell txn
                                let tries = 0
                                let amount = '0'
                                while (true && tries < 2000) {
                                    amount = await oneInch.balanceOf(tx.toToken.address)
                                    if (parseInt(amount) > parseInt(new BigNumber(token_amount).multipliedBy(0.5).toString())) {
                                        break
                                    }
                                    tries++
                                }

                                message = `Initiating a sell for token ${token.ticker}...`
                                console.log(message);
                                sendMessage(users, message)
                                let state = await approve(token, nonce + 1)
                                if (state) {
                                    nonce += 2
                                } else { nonce += 1 }
                                oneInch.swap({
                                    fromToken: tx.toToken.address,
                                    toToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                                    amount: amount.toString(),
                                    slippage: process.env.SLIPPAGE!,
                                    protocols: best_sell_protocols,
                                    gasLimit: process.env.GAS_LIMIT!,
                                    nonce: nonce
                                }).then(async (tx: Swap) => {
                                    cool_down_map = false
                                    if (tx.hash) {
                                        // save the tx to db
                                        new Trade({
                                            fromToken: tx.fromToken,
                                            toToken: tx.toToken,
                                            toTokenAmount: new BigNumber(tx.toTokenAmount).shiftedBy(-tx.toToken.decimals).toString(),
                                            fromTokenAmount: new BigNumber(tx.fromTokenAmount).shiftedBy(-tx.fromToken.decimals).toString(),
                                            protocols: (await flat(tx.protocols)).map((quote: Protocol) => quote.name).join(', '),
                                            estimatedGas: tx.estimatedGas,
                                            tx: tx.tx,
                                            direction: Direction.SELL,
                                            gasLimit: tx.gasLimit,
                                            hash: tx.hash
                                        }).save().then(async (doc: any) => {
                                            // send tg notification after saving
                                            message = `* NEW TRADE NOTIFICATION *\n-- - `
                                            message += `\n*Direction:* ${Direction.SELL}`
                                            message += `\n*Token Amount:* ${doc.fromTokenAmount}`
                                            message += `\n*Token:* ${tx.fromToken.name}`
                                            message += `\n*ETH Amount:* ${doc.toTokenAmount}`
                                            message += `\n*Profit PCT:* ${profit_pct.toFixed(6)}%`
                                            message += `\n*Dex:* ${doc.protocols}`
                                            message += `\n*Gas Limit:* ${doc.gasLimit}`
                                            message += `\n*Hash:* [${doc.hash.toUpperCase()}](${process.env.EXPLORER!}${doc.hash})`


                                            sendMessage(users, message)

                                        }).catch((err: any) => {
                                            console.error('Error:', err);
                                        });


                                    }
                                }).catch((err) => {
                                    cool_down_map = false

                                    let error = JSON.parse(JSON.stringify(err))?.response?.data?.message ? JSON.parse(JSON.stringify(err))?.data?.message : err
                                    if (!error) {
                                        error = err
                                    }
                                    console.error(error);
                                    message = `*TRADE TRANSACTION FAILED*\n---`
                                    message += `\n*Action:* ${Direction.SELL}`
                                    message += `\n*Token:* ${tx.toToken.name}`
                                    message += `\n*Error:* ${error}`
                                    message += `\n---`
                                    sendMessage(users, message)
                                });

                            } catch (err: any) {
                                let error = JSON.parse(JSON.stringify(err))?.response?.data?.message ? JSON.parse(JSON.stringify(err))?.data?.message : err
                                if (!error) {
                                    error = err
                                }
                                console.error(error);
                                cool_down_map = false
                                message = `*TRADE TRANSACTION FAILED*\n---`
                                message += `\n*Action:* ${Direction.SELL}`
                                message += `\n*Token:* ${tx.toToken.name}`
                                message += `\n*Error:* ${error}`
                                message += `\n---`
                                sendMessage(users, message)
                            }
                        }

                    }).catch((err: any) => {
                        let error = JSON.parse(JSON.stringify(err))?.response?.data?.message ? JSON.parse(JSON.stringify(err))?.response?.data?.message : err
                        if (!error) {
                            error = err
                        }
                        console.error(error);
                        cool_down_map = false
                        message = `*TRADE TRANSACTION FAILED*\n---`
                        message += `\n*Action:* ${Direction.BUY}`
                        message += `\n*Error:* ${error}`
                        message += `\n---`
                        sendMessage(users, message)
                    });


                }
            } catch (error: any) {
                // console.error('Error:', JSON.parse(JSON.stringify(error)).code);
            }

        });
    })

}


Main()
