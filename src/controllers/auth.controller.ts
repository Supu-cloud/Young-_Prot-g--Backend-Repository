import { Request, Response } from 'express';
import User from '../models/User.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { loginUser, registerUser } from '../services/auth.service';

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

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user?.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});
