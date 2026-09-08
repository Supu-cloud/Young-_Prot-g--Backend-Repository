import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.model';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import { AccountStatus, UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';

export async function quoteOrder(body: {
    restaurant?: unknown;
    items?: unknown;
    deliveryAddress?: unknown;
    note?: unknown;
}) {
    if (
        typeof body.restaurant !== 'string' ||
        !mongoose.isValidObjectId(body.restaurant)
    ) {
        throw new ApiError(400, 'Choose a real restaurant');
    }
    if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > 100
    ) {
        throw new ApiError(400, 'Choose between 1 and 100 menu items');
    }
    if (
        typeof body.deliveryAddress !== 'string' ||
        !body.deliveryAddress.trim() ||
        body.deliveryAddress.length > 1000
    ) {
        throw new ApiError(
            400,
            'A delivery address of up to 1000 characters is required'
        );
    }
    const restaurant = await Restaurant.findById(body.restaurant);
    if (
        !restaurant?.isOpen ||
        !restaurant.owner ||
        !(await User.exists({
            _id: restaurant.owner,
            role: UserRole.RESTAURANT_OWNER,
            accountStatus: AccountStatus.APPROVED,
            isEmailVerified: true,
        }))
    ) {
        throw new ApiError(
            409,
            'This restaurant is not currently accepting orders'
        );
    }
    const quantities = new Map<string, number>();
    for (const item of body.items) {
        if (
            !item ||
            typeof item.menuItem !== 'string' ||
            !mongoose.isValidObjectId(item.menuItem) ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 100
        ) {
            throw new ApiError(
                400,
                'Each item must have a real menu ID and quantity between 1 and 100'
            );
        }
        const quantity = (quantities.get(item.menuItem) ?? 0) + item.quantity;
        if (quantity > 100) {
            throw new ApiError(400, 'Maximum quantity per item is 100');
        }
        quantities.set(item.menuItem, quantity);
    }
    const items = [];
    let subtotalCents = 0;
    for (const [id, quantity] of quantities) {
        const item = await MenuItem.findById(id);
        if (
            !item?.available ||
            item.restaurant.toString() !== body.restaurant ||
            !Number.isFinite(item.price) ||
            item.price < 0
        ) {
            throw new ApiError(
                409,
                'A menu item is unavailable or belongs to another restaurant'
            );
        }
        const cents = Math.round(item.price * 100);
        subtotalCents += cents * quantity;
        items.push({
            menuItem: item._id,
            name: item.name,
            price: cents / 100,
            quantity,
        });
    }
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) {
        throw new ApiError(400, 'Invalid order amount');
    }
    return {
        restaurant: restaurant._id,
        items,
        subtotal: subtotalCents / 100,
        deliveryFee: 350,
        totalAmount: (subtotalCents + 35000) / 100,
        deliveryAddress: body.deliveryAddress.trim(),
        note:
            typeof body.note === 'string'
                ? body.note.trim().slice(0, 1000)
                : undefined,
    };
}
