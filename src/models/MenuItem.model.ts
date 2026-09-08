import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuItem extends Document {
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    category: string;
    restaurant: mongoose.Types.ObjectId;
    available: boolean;
}

const MenuItemSchema = new Schema<IMenuItem>(
    {
        name: { type: String, required: true },
        description: { type: String },
        price: { type: Number, required: true, min: 0 },
        imageUrl: { type: String },
        category: { type: String, required: true },
        restaurant: {
            type: Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true,
        },
        available: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
