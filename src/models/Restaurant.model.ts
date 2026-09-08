import mongoose, { Schema, Document } from 'mongoose';
import { RESTAURANT_CATEGORIES, RESTAURANT_LIMITS } from '../config/restaurant';

export interface IRestaurant extends Document {
    name: string;
    description: string;
    address: string;
    phone: string;
    imageUrl?: string;
    category: string;
    owner?: mongoose.Types.ObjectId;
    isOpen: boolean;
    operatingHours?: Record<
        string,
        { open: string; close: string; closed?: boolean }
    >;
}

const RestaurantSchema = new Schema<IRestaurant>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: RESTAURANT_LIMITS.name,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: RESTAURANT_LIMITS.description,
        },
        address: {
            type: String,
            required: true,
            trim: true,
            maxlength: RESTAURANT_LIMITS.address,
        },
        phone: { type: String, required: true },
        imageUrl: { type: String },
        category: { type: String, required: true, enum: RESTAURANT_CATEGORIES },
        owner: { type: Schema.Types.ObjectId, ref: 'User' },
        isOpen: { type: Boolean, default: true },
        operatingHours: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
