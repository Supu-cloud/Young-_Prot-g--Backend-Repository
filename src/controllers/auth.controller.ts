import { Request, Response } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendEmail } from '../services/email.service';
import {
    loginUser,
    registerRoleApplication,
    registerUser,
    assertUserCanAuthenticate,
} from '../services/auth.service';
import { createTokenPair, verifyRefreshToken } from '../services/token.service';
import { UserRole } from '../types/enums';

const sendVerificationEmailSafely = async (
    to: string,
    verifyUrl: string,
    requiresAdminApproval = false
): Promise<boolean> => {
    try {
        const approvalNote = requiresAdminApproval
            ? 'After verification, an administrator will review your application. We will email you when it is approved.'
            : 'After verification, you can sign in and start using Foodie.';
        await sendEmail({
            to,
            subject: 'Welcome to Foodie - Verify your email',
            text: `Thank you for joining Foodie!\n\nPlease verify your email address using this link:\n${verifyUrl}\n\n${approvalNote}\n\nThank you,\nThe Foodie Team`,
            html: `<h1>Welcome to Foodie!</h1><p>Thank you for joining us.</p><p>Please verify your email address to continue:</p><p><a href="${verifyUrl}">Verify my email</a></p><p>${approvalNote}</p><p>Thank you,<br>The Foodie Team</p>`,
        });
        return true;
    } catch {
        console.warn(
            'Verification email delivery failed. The account was saved.'
        );
        return false;
    }
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, phone, address } = req.body;

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await registerUser({
        name,
        email,
        password,
        phone,
        address,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: tokenExpires,
        isEmailVerified: false,
    });

    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
    const verificationEmailSent = await sendVerificationEmailSafely(
        email,
        verifyUrl
    );

    res.status(201).json(
        ApiResponse.ok(
            { user: result, verificationEmailSent },
            verificationEmailSent
                ? 'Account created! Please check your email to verify your account.'
                : 'Account created, but the verification email could not be sent. Please request another verification email.'
        )
    );
});

// 🟢 Missing Function 1: verifyEmail
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token) throw new ApiError(400, 'Verification token is required');

    const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json(
        ApiResponse.ok(
            null,
            user.role === UserRole.CUSTOMER
                ? 'Email verified successfully. You can now sign in.'
                : 'Email verified successfully. Your application is awaiting administrator approval.'
        )
    );
});

export const resendVerificationEmail = asyncHandler(
    async (req: Request, res: Response) => {
        const normalizedEmail = String(req.body.email ?? '')
            .trim()
            .toLowerCase();
        if (!normalizedEmail)
            throw new ApiError(400, 'Email address is required');

        const user = await User.findOne({ email: normalizedEmail });
        if (!user || user.isEmailVerified) {
            res.json(
                ApiResponse.ok(
                    null,
                    'If this account needs verification, a new email has been sent.'
                )
            );
            return;
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );
        await user.save();

        const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
        const sent = await sendVerificationEmailSafely(
            user.email,
            verifyUrl,
            user.role !== UserRole.CUSTOMER
        );
        if (!sent)
            throw new ApiError(
                503,
                'Verification email could not be sent. Please contact the administrator.'
            );
        res.json(
            ApiResponse.ok(
                null,
                'A new verification email has been sent. Please check your inbox.'
            )
        );
    }
);

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email ?? '')
        .trim()
        .toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) throw new ApiError(400, 'Invalid credentials');

    if (!user.isEmailVerified) {
        throw new ApiError(
            401,
            'Please verify your email address before logging in'
        );
    }

    const result = await loginUser({ email, password });
    res.json(ApiResponse.ok(result, 'Login successful'));
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;
    if (!idToken) throw new ApiError(400, 'Google ID Token is required');

    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new ApiError(500, 'Google authentication is not configured');
    }

    let ticket;
    try {
        ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
    } catch (error) {
        console.error('Google ID token verification failed:', error);
        throw new ApiError(401, 'Google token could not be verified');
    }

    const payload = ticket.getPayload();
    if (!payload) throw new ApiError(400, 'Invalid Google Token');

    const { sub: googleId, email, name, picture } = payload;
    if (!googleId || !email || !name) {
        throw new ApiError(
            400,
            'Google account does not provide required profile information'
        );
    }

    let user = await User.findOne({ email });

    if (!user) {
        user = await User.create({
            name,
            email,
            googleId,
            profilePicture: picture,
            isEmailVerified: true,
            role: UserRole.CUSTOMER,
        });
    } else if (!user.googleId) {
        user.googleId = googleId;
        if (!user.profilePicture) user.profilePicture = picture;
    }

    if (!user.isEmailVerified) {
        user.isEmailVerified = true;
    }
    if (user.isModified()) {
        await user.save();
    }
    assertUserCanAuthenticate(user);
    const tokens = createTokenPair({
        userId: user._id.toString(),
        role: user.role,
    });

    res.json(
        ApiResponse.ok(
            {
                ...tokens,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    accountStatus: user.accountStatus,
                    phone: user.phone,
                    address: user.address,
                    profilePicture: user.profilePicture,
                },
            },
            'Google authentication successful'
        )
    );
});

const submitRoleApplication = (
    role: UserRole.RESTAURANT_OWNER | UserRole.DELIVERY_RIDER
) =>
    asyncHandler(async (req: Request, res: Response) => {
        const { name, email, password, phone, address } = req.body;
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await registerRoleApplication({
            name,
            email,
            password,
            phone,
            address,
            role,
            isEmailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: tokenExpires,
        });
        const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}`;
        const verificationEmailSent = await sendVerificationEmailSafely(
            email,
            verifyUrl,
            true
        );
        res.status(201).json(
            ApiResponse.ok(
                { user, verificationEmailSent },
                verificationEmailSent
                    ? 'Application submitted for admin approval. Please verify your email.'
                    : 'Application saved for admin approval, but the verification email could not be sent. Please request another verification email.'
            )
        );
    });

export const signupRestaurantOwner = submitRoleApplication(
    UserRole.RESTAURANT_OWNER
);
export const signupDeliveryRider = submitRoleApplication(
    UserRole.DELIVERY_RIDER
);

export const refreshSession = asyncHandler(
    async (req: Request, res: Response) => {
        const { refreshToken } = req.body;
        if (!refreshToken) throw new ApiError(400, 'Refresh token is required');
        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            throw new ApiError(401, 'Refresh token is invalid or expired');
        }
        const user = await User.findById(payload.id);
        if (!user) throw new ApiError(401, 'Account no longer exists');
        assertUserCanAuthenticate(user);
        res.json(
            ApiResponse.ok(
                {
                    ...createTokenPair({
                        userId: user._id.toString(),
                        role: user.role,
                    }),
                    user,
                },
                'Session refreshed'
            )
        );
    }
);

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
        throw new ApiError(401, 'Authentication is required');
    }

    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});
