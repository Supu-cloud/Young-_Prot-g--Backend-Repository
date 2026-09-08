import mongoose, { Schema, Document } from 'mongoose';
import { AccountStatus, UserRole } from '../types/enums';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string; // Google Login සඳහා Optional කර ඇත
    role: UserRole;
    accountStatus: AccountStatus;
    phone?: string;
    address?: string;
    // නව ඔප්ෂනල් Fields (පැරණි System එකට බලපෑමක් නැත)
    isEmailVerified?: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    googleId?: string;
    profilePicture?: string;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    rejectionReason?: string;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true },

        // Custom Validator එකක් මගින් Password එක ආරක්ෂිත කර ඇත
        // Google User කෙනෙක් නෙවෙයි නම් විතරක් Password එක අනිවාර්ය වේ
        password: {
            type: String,
            required: function (this: IUser) {
                return !this.googleId; // googleId නැත්නම් පමණක් Password එක අනිවාර්යයි
            },
            minlength: 6,
        },

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

        // අලුතින් එකතු කළ ආරක්ෂිත Fields
        isEmailVerified: { type: Boolean, default: false },
        emailVerificationToken: { type: String },
        emailVerificationExpires: { type: Date },
        googleId: { type: String },
        profilePicture: { type: String, default: '' },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date },
        rejectionReason: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: true }
);

UserSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete (ret as Partial<IUser>).password;
        delete (ret as Partial<IUser>).emailVerificationToken;
        return ret;
    },
});

export default mongoose.model<IUser>('User', UserSchema);
