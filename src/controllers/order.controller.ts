import { Request, Response } from 'express';
import Order from '../models/Order.model';
import MenuItem from '../models/MenuItem.model';
import { OrderStatus } from '../types/enums';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Restaurant from '../models/Restaurant.model';
import { UserRole } from '../types/enums';

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
    const { restaurant, items, deliveryAddress, note } = req.body;
    if (!items || items.length === 0)
        throw new ApiError(400, 'Order must have at least one item');

    let totalAmount = 0;
    const orderItems = [];

    for (const cartItem of items) {
        const menuItem = await MenuItem.findById(cartItem.menuItem);
        if (!menuItem) throw new ApiError(404, `Menu item not found`);
        if (!menuItem.available)
            throw new ApiError(400, `${menuItem.name} is unavailable`);
        if (menuItem.restaurant.toString() !== restaurant)
            throw new ApiError(400, 'All items must belong to the restaurant');
        if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1)
            throw new ApiError(400, 'Item quantity must be a positive integer');
        totalAmount += menuItem.price * cartItem.quantity;
        orderItems.push({
            menuItem: menuItem._id,
            name: menuItem.name,
            quantity: cartItem.quantity,
            price: menuItem.price,
        });
    }

    const order = await Order.create({
        customer: req.user?.id,
        restaurant,
        items: orderItems,
        totalAmount,
        deliveryAddress,
        note,
    });
    res.status(201).json(ApiResponse.ok(order, 'Order placed successfully'));
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await Order.find({ customer: req.user?.id })
        .populate('restaurant', 'name imageUrl')
        .sort({ createdAt: -1 });
    res.json(ApiResponse.ok(orders));
});

export const getOrderById = asyncHandler(
    async (req: Request, res: Response) => {
        const order = await Order.findById(req.params.id)
            .populate('customer', 'name email phone')
            .populate('restaurant', 'name address phone');
        if (!order) throw new ApiError(404, 'Order not found');
        if (req.user?.role !== UserRole.ADMIN) {
            const isCustomer = order.customer.toString() === req.user?.id;
            const isRider = order.deliveryRider?.toString() === req.user?.id;
            const restaurant = await Restaurant.findOne({
                _id: order.restaurant,
                owner: req.user?.id,
            });
            if (!isCustomer && !isRider && !restaurant)
                throw new ApiError(403, 'Not authorized');
        }
        res.json(ApiResponse.ok(order));
    }
);

export const getAllOrders = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = req.query;
        const filter: Record<string, unknown> = {};
        if (req.user?.role === UserRole.RESTAURANT_OWNER) {
            const restaurants = await Restaurant.find({
                owner: req.user.id,
            }).select('_id');
            filter.restaurant = { $in: restaurants.map((item) => item._id) };
        }
        if (status) filter.status = status;
        const orders = await Order.find(filter)
            .populate('customer', 'name email')
            .populate('restaurant', 'name')
            .sort({ createdAt: -1 });
        res.json(ApiResponse.ok(orders));
    }
);

export const updateOrderStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = req.body;
        if (!Object.values(OrderStatus).includes(status))
            throw new ApiError(400, 'Invalid status');
        const order = await Order.findById(req.params.id);
        if (!order) throw new ApiError(404, 'Order not found');
        if (req.user?.role === UserRole.RESTAURANT_OWNER) {
            const ownsRestaurant = await Restaurant.exists({
                _id: order.restaurant,
                owner: req.user.id,
            });
            if (!ownsRestaurant)
                throw new ApiError(
                    403,
                    'This order is not for your restaurant'
                );
            const ownerStatuses = [
                OrderStatus.ACCEPTED,
                OrderStatus.DECLINED,
                OrderStatus.CONFIRMED,
                OrderStatus.PREPARING,
                OrderStatus.READY_FOR_PICKUP,
            ];
            if (!ownerStatuses.includes(status))
                throw new ApiError(403, 'Owner cannot set this order status');
        }
        order.status = status;
        await order.save();
        res.json(ApiResponse.ok(order, `Status updated to ${status}`));
    }
);

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.customer.toString() !== req.user?.id)
        throw new ApiError(403, 'Not authorized');
    if (['delivered', 'cancelled'].includes(order.status))
        throw new ApiError(400, 'Cannot cancel');
    order.status = OrderStatus.CANCELLED;
    await order.save();
    res.json(ApiResponse.ok(order, 'Order cancelled'));
});

export const getSalesAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
        const match: Record<string, unknown> = {
            status: OrderStatus.DELIVERED,
        };
        if (req.user?.role === UserRole.RESTAURANT_OWNER) {
            const restaurants = await Restaurant.find({
                owner: req.user.id,
            }).select('_id');
            match.restaurant = { $in: restaurants.map((item) => item._id) };
        }
        const [summary] = await Order.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$totalAmount' },
                    orderCount: { $sum: 1 },
                    averageOrderValue: { $avg: '$totalAmount' },
                },
            },
            { $project: { _id: 0 } },
        ]);
        const history = await Order.find(match)
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(
            ApiResponse.ok({
                summary: summary || {
                    revenue: 0,
                    orderCount: 0,
                    averageOrderValue: 0,
                },
                history,
            })
        );
    }
);
