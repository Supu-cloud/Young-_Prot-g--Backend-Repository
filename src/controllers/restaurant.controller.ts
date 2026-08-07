import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { UserRole } from '../types/enums';
import User from '../models/User.model';
import { AccountStatus } from '../types/enums';

const getOwnedRestaurant = async (
    id: string,
    userId?: string,
    role?: UserRole
) => {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) throw new ApiError(404, 'Restaurant not found');
    if (
        role !== UserRole.ADMIN &&
        (!userId || restaurant.owner.toString() !== userId)
    )
        throw new ApiError(403, 'You can only manage your own restaurant');
    return restaurant;
};

export const getAllRestaurants = asyncHandler(
    async (req: Request, res: Response) => {
        const { category, search } = req.query;
        const filter: Record<string, unknown> = {};
        if (category) filter.category = category;
        if (search) filter.name = { $regex: search, $options: 'i' };
        const restaurants = await Restaurant.find(filter).populate(
            'owner',
            'name email'
        );
        res.json(ApiResponse.ok(restaurants));
    }
);

export const getRestaurantById = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await Restaurant.findById(req.params.id).populate(
            'owner',
            'name email'
        );
        if (!restaurant) throw new ApiError(404, 'Restaurant not found');
        res.json(ApiResponse.ok(restaurant));
    }
);

export const createRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const { name, description, address, phone, category, imageUrl } =
            req.body;
        if (!name || !description || !address || !phone || !category)
            throw new ApiError(400, 'All fields required');
        const owner =
            req.user?.role === UserRole.ADMIN ? req.body.owner : req.user?.id;
        if (!owner) throw new ApiError(400, 'Restaurant owner is required');
        const ownerUser = await User.findOne({
            _id: owner,
            role: UserRole.RESTAURANT_OWNER,
            accountStatus: AccountStatus.APPROVED,
        });
        if (!ownerUser)
            throw new ApiError(400, 'An approved restaurant owner is required');
        const restaurant = await Restaurant.create({
            name,
            description,
            address,
            phone,
            category,
            imageUrl,
            owner,
        });
        res.status(201).json(ApiResponse.ok(restaurant, 'Restaurant created'));
    }
);

export const updateRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await getOwnedRestaurant(
            req.params.id,
            req.user?.id,
            req.user?.role
        );
        const protectedFields = ['owner', '_id'];
        for (const field of protectedFields) delete req.body[field];
        Object.assign(restaurant, req.body);
        await restaurant.save();
        res.json(ApiResponse.ok(restaurant, 'Restaurant updated'));
    }
);

export const deleteRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await getOwnedRestaurant(
            req.params.id,
            req.user?.id,
            req.user?.role
        );
        await restaurant.deleteOne();
        res.json(ApiResponse.ok(null, 'Restaurant deleted'));
    }
);

export const toggleRestaurantStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await getOwnedRestaurant(
            req.params.id,
            req.user?.id,
            req.user?.role
        );
        restaurant.isOpen = !restaurant.isOpen;
        await restaurant.save();
        res.json(
            ApiResponse.ok(
                restaurant,
                `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}`
            )
        );
    }
);
