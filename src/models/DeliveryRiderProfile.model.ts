import mongoose, { Document, Schema } from 'mongoose';

export interface IDeliveryRiderProfile extends Document {
    user: mongoose.Types.ObjectId;
    vehicleType: string;
    vehicleNumber: string;
    licenseNumber?: string;
    isAvailable: boolean;
    verificationDocuments: string[];
}

const DeliveryRiderProfileSchema = new Schema<IDeliveryRiderProfile>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        vehicleType: { type: String, required: true, trim: true },
        vehicleNumber: { type: String, required: true, trim: true },
        licenseNumber: { type: String, trim: true },
        isAvailable: { type: Boolean, default: false },
        verificationDocuments: [{ type: String, trim: true }],
    },
    { timestamps: true }
);

export default mongoose.model<IDeliveryRiderProfile>(
    'DeliveryRiderProfile',
    DeliveryRiderProfileSchema
);
