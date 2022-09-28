import { ethers } from "ethers";
import { bot } from "./bot";
import { UserDoc } from "./models";
require('dotenv').config()

if (!process.env.JSON_RPC) {
    throw new Error("JSON_RPC Must be in your .env file.");

}

export class Provider {
    provider: ethers.providers.JsonRpcProvider
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(process.env.JSON_RPC!)
    }
}

const flat = async (arr: Array<any>, start: number = 0, end: number = 3): Promise<Array<any>> => {
    if (start < end) {
        start += 1
        return flat([].concat(...arr), start)
    }
    return arr
}
const sendMessage = async (user: UserDoc[], message: string) => {
    user.map((u: UserDoc) => {
        try {
            bot.telegram.sendMessage(u.tg_id, message.replace('_', ' '), { parse_mode: 'Markdown', disable_web_page_preview: true }).catch((error) => { })
        } catch (error) {
            console.log(error);

        }
    }
    )
}
const toHex = (value: number) => {
    return `0x${value.toString(16)}`
}

export {
    flat,
    sendMessage,
    toHex
}