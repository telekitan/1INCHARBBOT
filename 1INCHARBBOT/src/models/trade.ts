import mongoose from 'mongoose';
import { Token, Tx } from '../types/1inch';
const { Schema, Types } = mongoose;

// An interface that describes attributes that a transaction should have
interface TradeAttrs {
    fromToken: Token;
    toToken: Token;
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: string;
    estimatedGas: number;
    tx: Tx;
    hash: string;
    gasLimit: number;
}

// An interface that describes what attributes a transaction model should have
interface TradeModel extends mongoose.Model<TradeDoc> {
    build(attrs: TradeAttrs): TradeDoc
}

// An interface that descibes single transaction properties
interface TradeDoc extends Document {
    fromToken: Token;
    toToken: Token
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: string;
    estimatedGas: number;
    tx: Tx;
    direction: string;
    hash: string;
    gasLimit: number;
}

// Creating transaction schema
const tradeSchema = new Schema({
    fromToken: {
        symbol: { type: String },
        name: { type: String },
        address: { type: String },
        decimals: { type: Number },
        logoURI: { type: String },
    },
    toToken: {
        symbol: { type: String },
        name: { type: String },
        address: { type: String },
        decimals: { type: Number },
        logoURI: { type: String },
    },
    toTokenAmount: { type: String },
    fromTokenAmount: { type: String },
    protocols: { type: String },
    estimatedGas: { type: Number },
    tx: {
        from: { type: String },
        to: { type: String },
        data: { type: String },
        value: { type: String },
        gasPrice: { type: String },
        gas: { type: Number },
    },
    direction: { type: String },
    hash: { type: String },
    gasLimit: { type: Number }
},
    {
        timestamps: true
    })

// Statics
tradeSchema.statics.build = (attrs: TradeAttrs) => {
    return new Trade(attrs);
};

tradeSchema.pre(/^find/, function (next) {
    next();
});

// Creating transaction model
const Trade = mongoose.model<TradeDoc & TradeModel>('Trade', tradeSchema)

export { Trade, TradeDoc }