import mongoose, { Schema, Document } from 'mongoose';
import { OrderStatus, PaymentStatus } from '../types/enums';

interface IOrderItem {
    menuItem: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
}

export interface IOrder extends Document {
    customer: mongoose.Types.ObjectId;
    restaurant: mongoose.Types.ObjectId;
    items: IOrderItem[];
    totalAmount: number;
    status: OrderStatus;
    deliveryAddress: string;
    paymentStatus: PaymentStatus;
    note?: string;
}

const OrderSchema = new Schema<IOrder>(
    {
        customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        restaurant: {
            type: Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true,
        },
        items: [
            {
                menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
                name: { type: String, required: true },
                quantity: { type: Number, required: true, min: 1 },
                price: { type: Number, required: true },
                _id: false,
            },
        ],
        totalAmount: { type: Number, required: true },
        status: {
            type: String,
            enum: Object.values(OrderStatus),
            default: OrderStatus.PLACED,
        },
        deliveryAddress: { type: String, required: true },
        paymentStatus: {
            type: String,
            enum: Object.values(PaymentStatus),
            default: PaymentStatus.PENDING,
        },
        note: { type: String },
    },
    { timestamps: true }
);

export default mongoose.model<IOrder>('Order', OrderSchema);
