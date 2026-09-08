import bcrypt from 'bcryptjs';

import User, { type IUser } from '../models/User.model';
import { AccountStatus, UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { createTokenPair } from './token.service';

const MINIMUM_PASSWORD_LENGTH = 6;

export interface RegisterUserInput {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
    isEmailVerified?: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
}

export interface RegisterRoleApplicationInput extends RegisterUserInput {
    role: UserRole.RESTAURANT_OWNER | UserRole.DELIVERY_RIDER;
}

export interface LoginUserInput {
    email: string;
    password: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const validateCredentials = (email: string, password: string): void => {
    if (!email.trim() || !password) {
        throw new ApiError(400, 'Email and password are required');
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new ApiError(400, 'A valid email address is required');
    }
};

const createAuthResult = (user: IUser) => ({
    ...createTokenPair({
        userId: user._id.toString(),
        role: user.role,
    }),
    user,
});

export const registerUser = async (input: RegisterUserInput) => {
    const name = input.name?.trim();
    validateCredentials(input.email ?? '', input.password ?? '');

    if (!name) {
        throw new ApiError(400, 'Name is required');
    }

    if (input.password.length < MINIMUM_PASSWORD_LENGTH) {
        throw new ApiError(
            400,
            `Password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters`
        );
    }

    const email = normalizeEmail(input.email);

    if (await User.exists({ email })) {
        throw new ApiError(409, 'Email already in use');
    }

    const user = await User.create({
        name,
        email,
        password: await bcrypt.hash(input.password, 10),
        role: UserRole.CUSTOMER,
        phone: input.phone?.trim() || undefined,
        address: input.address?.trim() || undefined,
        isEmailVerified: input.isEmailVerified ?? false,
        emailVerificationToken: input.emailVerificationToken,
        emailVerificationExpires: input.emailVerificationExpires,
    });

    return user;
};

export const registerRoleApplication = async (
    input: RegisterRoleApplicationInput
) => {
    const name = input.name?.trim();
    validateCredentials(input.email ?? '', input.password ?? '');
    if (!name) throw new ApiError(400, 'Name is required');
    if (input.password.length < MINIMUM_PASSWORD_LENGTH)
        throw new ApiError(400, 'Password must contain at least 6 characters');

    const email = normalizeEmail(input.email);
    if (await User.exists({ email }))
        throw new ApiError(409, 'Email already in use');

    return User.create({
        name,
        email,
        password: await bcrypt.hash(input.password, 10),
        role: input.role,
        accountStatus: AccountStatus.PENDING,
        phone: input.phone?.trim() || undefined,
        address: input.address?.trim() || undefined,
        isEmailVerified: input.isEmailVerified ?? false,
        emailVerificationToken: input.emailVerificationToken,
        emailVerificationExpires: input.emailVerificationExpires,
    });
};

export const loginUser = async (input: LoginUserInput) => {
    validateCredentials(input.email ?? '', input.password ?? '');

    const user = await User.findOne({
        email: normalizeEmail(input.email),
    }).select('+password');

    if (
        !user ||
        !user.password ||
        !(await bcrypt.compare(input.password, user.password))
    ) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Existing users created before accountStatus was introduced are treated as
    // approved. New owner/rider applications always receive an explicit status.
    if (user.accountStatus && user.accountStatus !== AccountStatus.APPROVED) {
        throw new ApiError(403, `Account is ${user.accountStatus}`);
    }

    return createAuthResult(user);
};

export const assertUserCanAuthenticate = (user: IUser): void => {
    if (!user.isEmailVerified) {
        throw new ApiError(
            401,
            'Please verify your email address before logging in'
        );
    }
    if (user.accountStatus !== AccountStatus.APPROVED) {
        throw new ApiError(403, `Account is ${user.accountStatus}`);
    }
};
