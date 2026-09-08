import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { UserRole } from '../types/enums';
import { validateRestaurantInput } from '../services/restaurant-validation';
import { validateRestaurantLogo } from '../services/restaurant-logo.service';
import { saveOwnerRestaurant } from '../services/owner-restaurant.service';
import {
    IMAGE_MAX_BYTES,
    IMAGE_TYPES,
    RESTAURANT_CATEGORIES,
    RESTAURANT_DAYS,
    RESTAURANT_LIMITS,
    RESTAURANT_PHONE_PATTERN,
} from '../config/restaurant';

const getOwnedRestaurant = async (
    id: string,
    userId?: string,
    role?: UserRole
) => {
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) throw new ApiError(404, 'Restaurant not found');
    if (
        role !== UserRole.ADMIN &&
        (!userId || !restaurant.owner || restaurant.owner.toString() !== userId)
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

export const getRestaurantOptions = asyncHandler(
    async (_req: Request, res: Response) => {
        res.json(
            ApiResponse.ok({
                categories: RESTAURANT_CATEGORIES,
                days: RESTAURANT_DAYS,
                limits: RESTAURANT_LIMITS,
                phonePattern: RESTAURANT_PHONE_PATTERN,
                image: { maxBytes: IMAGE_MAX_BYTES, types: IMAGE_TYPES },
            })
        );
    }
);

export const createRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await saveOwnerRestaurant(req.user!.id, req.body);
        res.json(ApiResponse.ok(restaurant, 'Restaurant saved'));
    }
);

export const updateRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await getOwnedRestaurant(
            req.params.id,
            req.user?.id,
            req.user?.role
        );
        const values = validateRestaurantInput(req.body, true);
        await validateRestaurantLogo(
            values.imageUrl,
            req.user!.id,
            restaurant.imageUrl
        );
        Object.assign(restaurant, values);
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
