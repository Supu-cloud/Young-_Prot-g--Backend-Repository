import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user?.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});

export const updateProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const user = await User.findByIdAndUpdate(req.user?.id, req.body, {
            new: true,
        });
        if (!user) throw new ApiError(404, 'User not found');
        res.json(ApiResponse.ok(user, 'Profile updated'));
    }
);

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user?.id).select('+password');
        if (!user) throw new ApiError(404, 'User not found');
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) throw new ApiError(400, 'Current password incorrect');
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json(ApiResponse.ok(null, 'Password changed'));
    }
);

export const getAllUsers = asyncHandler(
    async (_req: Request, res: Response) => {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(ApiResponse.ok(users));
    }
);

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(null, 'User deleted'));
});
