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
    deliveryFee: number;
    status: OrderStatus;
    deliveryAddress: string;
    paymentStatus: PaymentStatus;
    paymentIntentId?: string;
    deliveryRider?: mongoose.Types.ObjectId;
    note?: string;
    createdAt: Date;
    updatedAt: Date;
    subtotal?: number;
    paymentMethod?: string;
    placedAt?: Date;
    confirmedAt?: Date;
    preparingAt?: Date;
    readyForPickupAt?: Date;
    riderAssignedAt?: Date;
    pickedUpAt?: Date;
    outForDeliveryAt?: Date;
    deliveredAt?: Date;
    deliveryFailedAt?: Date;
    cancelledAt?: Date;
    settlement?: {
        restaurantAmount: number;
        riderAmount: number;
        restaurantStatus: string;
        riderStatus: string;
        availableAt?: Date;
    };
    deliveryReview?: {
        riderRating: number;
        serviceRating: number;
        comment?: string;
        createdAt: Date;
    };
    customerReceipt?: { status: 'received' | 'not_received'; createdAt: Date };
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
        deliveryFee: { type: Number, required: true, default: 0, min: 0 },
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
        paymentIntentId: { type: String, select: false },
        deliveryRider: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
        subtotal: { type: Number, min: 0 },
        paymentMethod: { type: String, enum: ['stripe_test', 'cash'] },
        placedAt: Date,
        confirmedAt: Date,
        preparingAt: Date,
        readyForPickupAt: Date,
        riderAssignedAt: Date,
        pickedUpAt: Date,
        outForDeliveryAt: Date,
        deliveredAt: Date,
        deliveryFailedAt: Date,
        cancelledAt: Date,
        settlement: {
            type: new Schema(
                {
                    restaurantAmount: { type: Number, min: 0 },
                    riderAmount: { type: Number, min: 0 },
                    restaurantStatus: {
                        type: String,
                        enum: ['pending', 'available', 'cancelled'],
                    },
                    riderStatus: {
                        type: String,
                        enum: ['pending', 'available', 'cancelled'],
                    },
                    availableAt: Date,
                },
                { _id: false }
            ),
        },
        deliveryReview: {
            type: new Schema(
                {
                    riderRating: {
                        type: Number,
                        min: 1,
                        max: 5,
                        required: true,
                    },
                    serviceRating: {
                        type: Number,
                        min: 1,
                        max: 5,
                        required: true,
                    },
                    comment: { type: String, maxlength: 2000 },
                    createdAt: { type: Date, default: Date.now },
                },
                { _id: false }
            ),
        },
        customerReceipt: {
            type: new Schema(
                {
                    status: {
                        type: String,
                        enum: ['received', 'not_received'],
                        required: true,
                    },
                    createdAt: { type: Date, default: Date.now },
                },
                { _id: false }
            ),
        },
    },
    { timestamps: true }
);

export default mongoose.model<IOrder>('Order', OrderSchema);
