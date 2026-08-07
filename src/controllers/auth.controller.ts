import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { createTokenPair } from '../services/token.service';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role, phone, address } = req.body;
    if (!name || !email || !password)
        throw new ApiError(400, 'Name, email and password required');
    if (await User.findOne({ email }))
        throw new ApiError(400, 'Email already in use');

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
        name,
        email,
        password: hashed,
        role,
        phone,
        address,
    });
    const tokens = createTokenPair({
        userId: user._id.toString(),
        role: user.role,
    });

    res.status(201).json(
        ApiResponse.ok({ ...tokens, user }, 'Account created')
    );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password)
        throw new ApiError(400, 'Email and password required');

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password)))
        throw new ApiError(400, 'Invalid credentials');

    const tokens = createTokenPair({
        userId: user._id.toString(),
        role: user.role,
    });
    res.json(ApiResponse.ok({ ...tokens, user }, 'Login successful'));
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user?.id);
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});
