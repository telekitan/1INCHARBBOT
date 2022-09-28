import { connect } from "mongoose"
import { MONITORED_TOKENS } from "./data/tokens"
import { UserToken } from "./types/1inch"
import { approve } from "./utils"

const Main = async () => {
    console.log('Connecting to MongoDb...\n---');
    const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        keepAlive: true,
        connectTimeoutMS: 60000,
        socketTimeoutMS: 60000,
    }

    await connect(process.env.DB_URL!, options).then(() => {
        console.log("Connected to MongoDb :)");
    }).catch(async (err) => {
        let error = JSON.parse(JSON.stringify(err))
        console.log('Mongo Error:', error?.name);
    });
    console.log(`---`.repeat(10));

    for (let index = 0; index < MONITORED_TOKENS.length; index++) {
        const token: UserToken = MONITORED_TOKENS[index];

        await approve(token)

    }
}

Main()
