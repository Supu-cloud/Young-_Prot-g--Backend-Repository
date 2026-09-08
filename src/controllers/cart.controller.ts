import { Request, Response } from 'express';
import Cart from '../models/Cart.model';
import MenuItem from '../models/MenuItem.model';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const cartSummary = async (customer?: string) => {
    const cart = await Cart.findOne({ customer }).populate(
        'items.menuItem',
        'name price imageUrl available restaurant'
    );
    if (!cart) return { items: [], totalAmount: 0 };
    const totalAmount = cart.items.reduce((sum, item) => {
        const menuItem = item.menuItem as unknown as { price?: number };
        return sum + (menuItem.price || 0) * item.quantity;
    }, 0);
    return { ...cart.toObject(), totalAmount };
};

export const getCart = asyncHandler(async (req: Request, res: Response) => {
    res.json(ApiResponse.ok(await cartSummary(req.user?.id)));
});

export const addCartItem = asyncHandler(async (req: Request, res: Response) => {
    const { menuItem: menuItemId, quantity = 1 } = req.body;
    if (!Number.isInteger(quantity) || quantity < 1)
        throw new ApiError(400, 'Quantity must be a positive integer');
    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem || !menuItem.available)
        throw new ApiError(400, 'Menu item is unavailable');
    let cart = await Cart.findOne({ customer: req.user?.id });
    if (!cart)
        cart = await Cart.create({
            customer: req.user?.id,
            restaurant: menuItem.restaurant,
            items: [],
        });
    if (cart.restaurant?.toString() !== menuItem.restaurant.toString())
        throw new ApiError(
            400,
            'A cart can contain items from one restaurant only'
        );
    const existing = cart.items.find(
        (item) => item.menuItem.toString() === menuItem.id
    );
    if (existing) existing.quantity += quantity;
    else cart.items.push({ menuItem: menuItem._id, quantity });
    await cart.save();
    res.status(201).json(
        ApiResponse.ok(await cartSummary(req.user?.id), 'Cart updated')
    );
});

export const updateCartItem = asyncHandler(
    async (req: Request, res: Response) => {
        const { quantity } = req.body;
        if (!Number.isInteger(quantity) || quantity < 1)
            throw new ApiError(400, 'Quantity must be a positive integer');
        const cart = await Cart.findOne({ customer: req.user?.id });
        const item = cart?.items.find(
            (entry) => entry.menuItem.toString() === req.params.menuItemId
        );
        if (!cart || !item) throw new ApiError(404, 'Cart item not found');
        item.quantity = quantity;
        await cart.save();
        res.json(
            ApiResponse.ok(await cartSummary(req.user?.id), 'Cart updated')
        );
    }
);

export const removeCartItem = asyncHandler(
    async (req: Request, res: Response) => {
        const cart = await Cart.findOne({ customer: req.user?.id });
        if (!cart) throw new ApiError(404, 'Cart not found');
        const before = cart.items.length;
        cart.items = cart.items.filter(
            (entry) => entry.menuItem.toString() !== req.params.menuItemId
        );
        if (cart.items.length === before)
            throw new ApiError(404, 'Cart item not found');
        if (cart.items.length === 0) cart.restaurant = undefined;
        await cart.save();
        res.json(
            ApiResponse.ok(await cartSummary(req.user?.id), 'Cart item removed')
        );
    }
);

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
    await Cart.deleteOne({ customer: req.user?.id });
    res.json(ApiResponse.ok({ items: [], totalAmount: 0 }, 'Cart cleared'));
});
