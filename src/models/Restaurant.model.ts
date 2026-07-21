import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  name:        string;
  description: string;
  address:     string;
  phone:       string;
  imageUrl?:   string;
  category:    string;
  owner:       mongoose.Types.ObjectId;
  isOpen:      boolean;
}

const RestaurantSchema = new Schema<IRestaurant>({
  name:        { type: String, required: true },
  description: { type: String, required: true },
  address:     { type: String, required: true },
  phone:       { type: String, required: true },
  imageUrl:    { type: String },
  category:    { type: String, required: true },
  owner:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isOpen:      { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);