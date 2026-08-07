import type { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { verifyAccessToken } from '../services/token.service';
import { UserRole } from '../types/enums';

const unauthorized = (res: Response, message: string): void => {
    res.status(401).json({
        success: false,
        message,
    });
};

export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const authorization = req.header('authorization');

    if (!authorization) {
        unauthorized(res, 'Authentication token is required');
        return;
    }

    const [scheme, token, extraPart] = authorization.trim().split(/\s+/);

    if (scheme?.toLowerCase() !== 'bearer' || !token || extraPart) {
        unauthorized(res, 'Use the Authorization: Bearer <token> format');
        return;
    }

    try {
        req.user = verifyAccessToken(token);
        next();
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            unauthorized(res, 'Authentication token has expired');
            return;
        }

        if (error instanceof JsonWebTokenError) {
            unauthorized(res, 'Authentication token is invalid');
            return;
        }

        next(error);
    }
};

export const authorize =
    (...allowedRoles: UserRole[]) =>
    (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            unauthorized(res, 'Authentication is required');
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action',
            });
            return;
        }

        next();
    };

// Compatibility names used by the existing route modules.
export const protect = authenticate;
export const adminOnly = authorize(UserRole.ADMIN);
