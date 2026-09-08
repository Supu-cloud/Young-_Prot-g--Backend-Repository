import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import '../config/env';
import connectDB from '../config/db';
import User from '../models/User.model';
import { AccountStatus, UserRole } from '../types/enums';

const MINIMUM_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const requiredValue = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
};

const createAdmin = async (): Promise<void> => {
    const name = requiredValue('ADMIN_NAME');
    const email = requiredValue('ADMIN_EMAIL').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!password) throw new Error('ADMIN_PASSWORD is required');

    if (!EMAIL_PATTERN.test(email)) {
        throw new Error('ADMIN_EMAIL must be a valid email address');
    }
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
        throw new Error(
            `ADMIN_PASSWORD must contain at least ${MINIMUM_PASSWORD_LENGTH} characters`
        );
    }

    await connectDB();

    const [existingEmail, existingAdmin] = await Promise.all([
        User.exists({ email }),
        User.exists({ role: UserRole.ADMIN }),
    ]);

    if (existingEmail) {
        throw new Error(
            'An account with ADMIN_EMAIL already exists; no changes made'
        );
    }
    if (existingAdmin) {
        throw new Error(
            'An administrator account already exists; no changes made'
        );
    }

    await User.create({
        name,
        email,
        password: await bcrypt.hash(password, 10),
        role: UserRole.ADMIN,
        accountStatus: AccountStatus.APPROVED,
        isEmailVerified: true,
    });

    console.log(`Administrator account created for ${email}.`);
};

createAdmin()
    .catch((error: unknown) => {
        const message =
            error instanceof Error
                ? error.message
                : 'Unable to create administrator';
        console.error(`Admin provisioning failed: ${message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
