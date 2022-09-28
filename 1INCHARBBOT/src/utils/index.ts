import { OneInch } from "../1inch"
import { Direction } from "../enums/trade"
import { sendMessage } from "../helpers"
import { User } from "../models"
import { Approve } from "../models/approve"
import { UserToken } from "../types/1inch"

let message = ''
const approve = async (token: UserToken, nonce?: number) => {
    const oneInch = new OneInch()

    if (!nonce) {
        nonce = NaN
    }
    // check if the token in ctx is approved?
    const approve = await Approve.exists({ token: token, by: process.env.PUBLIC_KEY!.toLowerCase() })
    let state = false
    if (!approve) {
        let users = await User.find({ is_active: true })
        // when token is not approved, approve b4 we sell

        message = `Approving ${token.description}...`
        console.log(message);

        sendMessage(users, message)
        try {
            await oneInch.approve({
                token: token.address,
                infinity: true,
                nonce: nonce
            }).then(async (res: any) => {
                await new Approve({
                    token: token,
                    is_approved: true,
                    hash: res.hash,
                    by: process.env.PUBLIC_KEY!.toLowerCase(),
                    pk: `${token.address}${process.env.PUBLIC_KEY!.toLowerCase()}`
                }).save().then((doc: any) => {
                    message = `*NEW APPROVE NOTIFICATION*\n---`
                    message += `\n*Action:* ${Direction.APPROVE}`
                    message += `\n*Token:* ${token.description}`
                    message += `\n*Hash:* [${doc.hash.toUpperCase()}](${process.env.EXPLORER!}/${doc.hash})`

                    sendMessage(users, message)

                    state = true
                }).catch((err: any) => {
                    message = `*Error:* ${JSON.stringify(err)} while approving ${token.description}`
                    sendMessage(users, message)
                    state = false
                })

            }).catch((err: any) => {
                let error = JSON.parse(JSON.stringify(err))?.response?.data?.message ? JSON.parse(JSON.stringify(err))?.data?.message : err
                console.error(error);
                message = `*TRADE TRANSACTION FAILED*\n---`
                message += `\n*Action:* ${Direction.APPROVE}`
                message += `\n*Error:* ${error}`
                message += `\n---`
                sendMessage(users, message)
                state = false
            })
        }
        catch (err: any) {
            console.error(err);
            state = false
        }

    }
    return state
}


export {
    approve
}