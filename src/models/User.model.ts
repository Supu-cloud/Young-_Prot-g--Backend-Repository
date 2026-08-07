import mongoose, { Schema, Document } from 'mongoose';
import { AccountStatus, UserRole } from '../types/enums';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    accountStatus: AccountStatus;
    phone?: string;
    address?: string;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, required: true, minlength: 6 },
        role: {
            type: String,
            enum: Object.values(UserRole),
            default: UserRole.CUSTOMER,
        },
        accountStatus: {
            type: String,
            enum: Object.values(AccountStatus),
            default: AccountStatus.APPROVED,
        },
        phone: { type: String },
        address: { type: String },
    },
    { timestamps: true }
);

UserSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete (ret as Partial<IUser>).password;
        return ret;
    },
});

export default mongoose.model<IUser>('User', UserSchema);
