import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurantOwnerProfile extends Document {
    user: mongoose.Types.ObjectId;
    businessName: string;
    businessRegistrationNumber?: string;
}

const RestaurantOwnerProfileSchema = new Schema<IRestaurantOwnerProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        businessName: { type: String, required: true, trim: true },
        businessRegistrationNumber: { type: String, trim: true },
    },
    { timestamps: true }
);

export default mongoose.model<IRestaurantOwnerProfile>(
    'RestaurantOwnerProfile',
    RestaurantOwnerProfileSchema
);
