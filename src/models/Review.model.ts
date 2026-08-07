import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
    customer: mongoose.Types.ObjectId;
    restaurant: mongoose.Types.ObjectId;
    rating: number;
    comment: string;
}

const ReviewSchema = new Schema<IReview>(
    {
        customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        restaurant: {
            type: Schema.Types.ObjectId,
            ref: 'Restaurant',
            required: true,
        },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
    },
    { timestamps: true }
);

ReviewSchema.index({ customer: 1, restaurant: 1 }, { unique: true });

export default mongoose.model<IReview>('Review', ReviewSchema);
