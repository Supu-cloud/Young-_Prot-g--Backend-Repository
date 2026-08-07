import { Request, Response } from 'express';
import User from '../models/User.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import {
    loginUser,
    registerRoleApplication,
    registerUser,
} from '../services/auth.service';
import { UserRole } from '../types/enums';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, phone, address } = req.body;
    const result = await registerUser({
        name,
        email,
        password,
        phone,
        address,
    });

    res.status(201).json(ApiResponse.ok(result, 'Account created'));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    res.json(ApiResponse.ok(result, 'Login successful'));
});

const submitRoleApplication = (
    role: UserRole.RESTAURANT_OWNER | UserRole.DELIVERY_RIDER
) =>
    asyncHandler(async (req: Request, res: Response) => {
        const { name, email, password, phone, address } = req.body;
        const user = await registerRoleApplication({
            name,
            email,
            password,
            phone,
            address,
            role,
        });
        res.status(201).json(
            ApiResponse.ok(user, 'Application submitted for admin approval')
        );
    });

export const signupRestaurantOwner = submitRoleApplication(
    UserRole.RESTAURANT_OWNER
);
export const signupDeliveryRider = submitRoleApplication(
    UserRole.DELIVERY_RIDER
);

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
        throw new ApiError(401, 'Authentication is required');
    }

    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});
