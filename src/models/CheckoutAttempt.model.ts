import { Schema, model, Types } from 'mongoose';

// A durable payment recovery record, never an order shown in a role dashboard.
const schema = new Schema(
    {
        _id: { type: Schema.Types.ObjectId, required: true },
        customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        quote: { type: Schema.Types.Mixed, required: true },
        paymentIntentId: String,
    },
    { timestamps: true }
);
export interface CheckoutQuote {
    restaurant: Types.ObjectId;
    items: Array<{
        menuItem: Types.ObjectId;
        name: string;
        price: number;
        quantity: number;
    }>;
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    deliveryAddress: string;
    note?: string;
}
export default model('CheckoutAttempt', schema);
