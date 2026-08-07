import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import type { AuthenticatedUser, TokenPair, TokenUser } from '../types';
import { UserRole } from '../types/enums';

const DEFAULT_ACCESS_TOKEN_TTL = '15m';
const DEFAULT_REFRESH_TOKEN_TTL = '7d';
const DEFAULT_ISSUER = 'food-ordering-api';
const DEFAULT_AUDIENCE = 'food-ordering-client';
const MINIMUM_SECRET_LENGTH = 32;

type TokenKind = 'access' | 'refresh';

const getRequiredSecret = (
    name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'
): string => {
    const secret = process.env[name];

    if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
        throw new Error(
            `${name} must contain at least ${MINIMUM_SECRET_LENGTH} characters`
        );
    }

    return secret;
};

const getTokenTtl = (
    name: 'JWT_ACCESS_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN',
    fallback: string
): SignOptions['expiresIn'] => {
    const value = process.env[name] || fallback;

    if (!/^\d+[smhd]$/.test(value)) {
        throw new Error(`${name} must use a value such as 15m, 1h, or 7d`);
    }

    return value as SignOptions['expiresIn'];
};

const getCommonOptions = (): Pick<
    SignOptions,
    'algorithm' | 'audience' | 'issuer'
> => ({
    algorithm: 'HS256',
    audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
    issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
});

const signToken = (user: TokenUser, tokenType: TokenKind): string => {
    const isAccessToken = tokenType === 'access';
    const secret = getRequiredSecret(
        isAccessToken ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET'
    );
    const expiresIn = getTokenTtl(
        isAccessToken ? 'JWT_ACCESS_EXPIRES_IN' : 'JWT_REFRESH_EXPIRES_IN',
        isAccessToken ? DEFAULT_ACCESS_TOKEN_TTL : DEFAULT_REFRESH_TOKEN_TTL
    );

    return jwt.sign(
        {
            role: user.role,
            tokenType,
        },
        secret,
        {
            ...getCommonOptions(),
            expiresIn,
            jwtid: randomUUID(),
            subject: user.userId,
        }
    );
};

const verifyToken = (
    token: string,
    expectedType: TokenKind
): AuthenticatedUser => {
    const secret = getRequiredSecret(
        expectedType === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET'
    );
    const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
        issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
    });

    if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        typeof payload.role !== 'string' ||
        !Object.values(UserRole).includes(payload.role as UserRole) ||
        payload.tokenType !== expectedType
    ) {
        throw new Error(`Invalid ${expectedType} token payload`);
    }

    return {
        id: payload.sub,
        userId: payload.sub,
        role: payload.role as UserRole,
    };
};

export const createTokenPair = (user: TokenUser): TokenPair => ({
    accessToken: signToken(user, 'access'),
    refreshToken: signToken(user, 'refresh'),
});

export const verifyAccessToken = (token: string): AuthenticatedUser =>
    verifyToken(token, 'access');

export const verifyRefreshToken = (token: string): AuthenticatedUser =>
    verifyToken(token, 'refresh');
