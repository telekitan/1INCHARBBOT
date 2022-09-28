import { Model, Document, model, Schema } from "mongoose";
import { UserToken } from "../types/1inch";

// An interface that describes attributes that a transaction should have
interface ApproveAttrs {
    token: UserToken;
    is_approved?: boolean;
    hash?: string;
    by: string;
    pk: string;
}

// An interface that describes what attributes a transaction model should have
interface ApproveModel extends Model<ApproveDoc> {
    build(attrs: ApproveAttrs): ApproveDoc;
}

// An interface that descibes single transaction properties
interface ApproveDoc extends Document {
    token: UserToken;
    is_approved?: boolean;
    hash?: string;
    by: string;
    pk: string;
}

// Creating transaction schema
const approveSchema = new Schema(
    {
        token: {
            address: { type: String },
            ticker: { type: String },
            description: { type: String },
        },
        is_approved: { type: Boolean, default: false },
        hash: { type: String },
        by: { type: String },
        pk: { type: String, unique: true },
    },
    {
        timestamps: true,
    }
);

// Statics
approveSchema.statics.build = (attrs: ApproveAttrs) => {
    return new Approve(attrs);
};

// Creating transaction model
const Approve = model<ApproveDoc & ApproveModel>("Approve", approveSchema);

export { Approve, ApproveDoc };
