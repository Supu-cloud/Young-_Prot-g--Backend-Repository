import { Request, Response } from 'express';
import MenuItem from '../models/MenuItem.model';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Restaurant from '../models/Restaurant.model';
import { UserRole } from '../types/enums';

const ensureRestaurantAccess = async (
    restaurantId: string,
    userId?: string,
    role?: UserRole
) => {
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) throw new ApiError(404, 'Restaurant not found');
    if (
        role !== UserRole.ADMIN &&
        (!userId || !restaurant.owner || restaurant.owner.toString() !== userId)
    )
        throw new ApiError(403, 'You can only manage your own menu');
};

export const getMenuByRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const items = await MenuItem.find({
            restaurant: req.params.restaurantId,
            available: true,
        });
        res.json(ApiResponse.ok(items));
    }
);

export const getMenuItemById = asyncHandler(
    async (req: Request, res: Response) => {
        const item = await MenuItem.findById(req.params.id);
        if (!item) throw new ApiError(404, 'Menu item not found');
        res.json(ApiResponse.ok(item));
    }
);

export const createMenuItem = asyncHandler(
    async (req: Request, res: Response) => {
        const { name, price, category, restaurant, description, imageUrl } =
            req.body;
        if (!name || !price || !category || !restaurant)
            throw new ApiError(400, 'All fields required');
        await ensureRestaurantAccess(restaurant, req.user?.id, req.user?.role);
        const item = await MenuItem.create({
            name,
            price,
            category,
            restaurant,
            description,
            imageUrl,
        });
        res.status(201).json(ApiResponse.ok(item, 'Menu item created'));
    }
);

export const updateMenuItem = asyncHandler(
    async (req: Request, res: Response) => {
        const item = await MenuItem.findById(req.params.id);
        if (!item) throw new ApiError(404, 'Menu item not found');
        await ensureRestaurantAccess(
            item.restaurant.toString(),
            req.user?.id,
            req.user?.role
        );
        delete req.body.restaurant;
        Object.assign(item, req.body);
        await item.save();
        res.json(ApiResponse.ok(item, 'Menu item updated'));
    }
);

export const deleteMenuItem = asyncHandler(
    async (req: Request, res: Response) => {
        const item = await MenuItem.findById(req.params.id);
        if (!item) throw new ApiError(404, 'Menu item not found');
        await ensureRestaurantAccess(
            item.restaurant.toString(),
            req.user?.id,
            req.user?.role
        );
        await item.deleteOne();
        res.json(ApiResponse.ok(null, 'Menu item deleted'));
    }
);

export const toggleAvailability = asyncHandler(
    async (req: Request, res: Response) => {
        const item = await MenuItem.findById(req.params.id);
        if (!item) throw new ApiError(404, 'Menu item not found');
        await ensureRestaurantAccess(
            item.restaurant.toString(),
            req.user?.id,
            req.user?.role
        );
        item.available = !item.available;
        await item.save();
        res.json(
            ApiResponse.ok(
                item,
                `Item is now ${item.available ? 'available' : 'unavailable'}`
            )
        );
    }
);
