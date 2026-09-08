import { saveOwnerRestaurant } from '../services/owner-restaurant.service';
import { storeRestaurantLogo } from '../services/restaurant-logo.service';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import MenuItem from '../models/MenuItem.model';
import Order from '../models/Order.model';
import Restaurant from '../models/Restaurant.model';
import User from '../models/User.model';
import { OrderStatus, PaymentStatus } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const activeStatuses = [
    OrderStatus.PLACED,
    OrderStatus.ACCEPTED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY_FOR_PICKUP,
    OrderStatus.RIDER_ASSIGNED,
    OrderStatus.PICKED_UP,
    OrderStatus.OUT_FOR_DELIVERY,
];

const ownedRestaurant = async (ownerId?: string) => {
    if (!ownerId) throw new ApiError(401, 'Authentication is required');
    return Restaurant.findOne({ owner: ownerId });
};

export const getOwnerRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        res.json(ApiResponse.ok(await ownedRestaurant(req.user?.id)));
    }
);

export const getOwnerMenu = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await ownedRestaurant(req.user?.id);
        const items = restaurant
            ? await MenuItem.find({ restaurant: restaurant._id }).sort({
                  createdAt: -1,
              })
            : [];
        res.json(ApiResponse.ok(items));
    }
);

export const getOwnerMenuItem = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await ownedRestaurant(req.user?.id);
        const item = await MenuItem.findOne({
            _id: req.params.id,
            restaurant: restaurant?._id ?? null,
        });
        if (!item)
            throw new ApiError(404, 'Menu item not found for your restaurant');
        res.json(ApiResponse.ok(item));
    }
);

export const getOwnerOrders = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await ownedRestaurant(req.user?.id);
        const filter: Record<string, unknown> = {
            restaurant: restaurant?._id ?? null,
        };
        if (req.query.status) filter.status = req.query.status;
        const orders = await Order.find(filter)
            .populate('customer', 'name email phone')
            .populate('restaurant', 'name imageUrl address phone')
            .populate('deliveryRider', 'name phone')
            .sort({ createdAt: -1 });
        res.json(ApiResponse.ok(orders));
    }
);

export const getOwnerOrder = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await ownedRestaurant(req.user?.id);
        const order = await Order.findOne({
            _id: req.params.id,
            restaurant: restaurant?._id ?? null,
        })
            .populate('customer', 'name email phone')
            .populate('restaurant', 'name imageUrl address phone')
            .populate('deliveryRider', 'name phone');
        if (!order)
            throw new ApiError(404, 'Order not found for your restaurant');
        res.json(ApiResponse.ok(order));
    }
);

export const getOwnerDashboard = asyncHandler(
    async (req: Request, res: Response) => {
        const owner = await User.findById(req.user?.id).select(
            'name email phone address role accountStatus'
        );
        if (!owner) throw new ApiError(404, 'Owner account not found');
        const restaurant = await ownedRestaurant(req.user?.id);
        if (!restaurant) {
            res.json(
                ApiResponse.ok({
                    owner,
                    restaurant: null,
                    metrics: {
                        todayOrders: 0,
                        activeOrders: 0,
                        completedOrders: 0,
                        todayRevenue: 0,
                        menuItems: 0,
                    },
                    recentOrders: [],
                })
            );
            return;
        }
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const orderBase = { restaurant: restaurant._id };
        const [
            todayOrders,
            activeOrders,
            completedOrders,
            todayRevenueRows,
            menuItems,
            recentOrders,
        ] = await Promise.all([
            Order.countDocuments({ ...orderBase, createdAt: { $gte: start } }),
            Order.countDocuments({
                ...orderBase,
                status: { $in: activeStatuses },
            }),
            Order.countDocuments({
                ...orderBase,
                status: OrderStatus.DELIVERED,
            }),
            Order.aggregate([
                {
                    $match: {
                        restaurant: restaurant._id,
                        status: OrderStatus.DELIVERED,
                        paymentStatus: PaymentStatus.PAID,
                        'settlement.restaurantStatus': 'available',
                        deliveredAt: { $gte: start },
                    },
                },
                {
                    $group: {
                        _id: null,
                        value: { $sum: '$settlement.restaurantAmount' },
                    },
                },
            ]),
            MenuItem.countDocuments({ restaurant: restaurant._id }),
            Order.find(orderBase)
                .populate('customer', 'name email phone')
                .sort({ createdAt: -1 })
                .limit(6),
        ]);
        res.json(
            ApiResponse.ok({
                owner,
                restaurant,
                metrics: {
                    todayOrders,
                    activeOrders,
                    completedOrders,
                    todayRevenue: todayRevenueRows[0]?.value || 0,
                    menuItems,
                },
                recentOrders,
            })
        );
    }
);

export const getOwnerAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await ownedRestaurant(req.user?.id);
        if (!restaurant) {
            res.json(
                ApiResponse.ok({
                    summary: {
                        todayRevenue: 0,
                        totalRevenue: 0,
                        orderCount: 0,
                        completedOrders: 0,
                        averageOrderValue: 0,
                    },
                    popularItems: [],
                    recentSales: [],
                })
            );
            return;
        }
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const restaurantId = new mongoose.Types.ObjectId(
            restaurant._id.toString()
        );
        const deliveredPaid = {
            restaurant: restaurantId,
            status: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
            'settlement.restaurantStatus': 'available',
        };
        const [summaryRows, todayRows, orderCount, popularItems, recentSales] =
            await Promise.all([
                Order.aggregate([
                    { $match: deliveredPaid },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: {
                                $sum: '$settlement.restaurantAmount',
                            },
                            completedOrders: { $sum: 1 },
                            averageOrderValue: { $avg: '$totalAmount' },
                        },
                    },
                ]),
                Order.aggregate([
                    {
                        $match: {
                            ...deliveredPaid,
                            deliveredAt: { $gte: start },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            value: { $sum: '$settlement.restaurantAmount' },
                        },
                    },
                ]),
                Order.countDocuments({ restaurant: restaurant._id }),
                Order.aggregate([
                    {
                        $match: {
                            restaurant: restaurantId,
                            status: OrderStatus.DELIVERED,
                        },
                    },
                    { $unwind: '$items' },
                    {
                        $group: {
                            _id: '$items.menuItem',
                            name: { $first: '$items.name' },
                            quantity: { $sum: '$items.quantity' },
                            revenue: {
                                $sum: {
                                    $multiply: [
                                        '$items.quantity',
                                        '$items.price',
                                    ],
                                },
                            },
                        },
                    },
                    { $sort: { quantity: -1 } },
                    { $limit: 8 },
                ]),
                Order.find(deliveredPaid)
                    .populate('customer', 'name email')
                    .sort({ createdAt: -1 })
                    .limit(10),
            ]);
        const summary = summaryRows[0] || {
            totalRevenue: 0,
            completedOrders: 0,
            averageOrderValue: 0,
        };
        res.json(
            ApiResponse.ok({
                summary: {
                    todayRevenue: todayRows[0]?.value || 0,
                    totalRevenue: summary.totalRevenue,
                    orderCount,
                    completedOrders: summary.completedOrders,
                    averageOrderValue: summary.averageOrderValue,
                },
                popularItems,
                recentSales,
            })
        );
    }
);

export const saveMyRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await saveOwnerRestaurant(req.user!.id, req.body);
        res.json(ApiResponse.ok(restaurant, 'Restaurant saved'));
    }
);

export const uploadRestaurantLogo = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.file)
            throw new ApiError(400, 'Choose a logo to upload.', {
                imageUrl: 'Choose a logo to upload.',
            });
        const imageUrl = await storeRestaurantLogo(req.file, req.user!.id);
        res.status(201).json(ApiResponse.ok({ imageUrl }, 'Logo uploaded'));
    }
);
