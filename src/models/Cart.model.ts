import mongoose, { Document, Schema } from 'mongoose';

export interface ICart extends Document {
    customer: mongoose.Types.ObjectId;
    restaurant?: mongoose.Types.ObjectId;
    items: { menuItem: mongoose.Types.ObjectId; quantity: number }[];
}

const CartSchema = new Schema<ICart>(
    {
        customer: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
        items: [
            {
                menuItem: {
                    type: Schema.Types.ObjectId,
                    ref: 'MenuItem',
                    required: true,
                },
                quantity: { type: Number, required: true, min: 1 },
                _id: false,
            },
        ],
    },
    { timestamps: true }
);

export default mongoose.model<ICart>('Cart', CartSchema);
