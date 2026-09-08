import { Request, Response } from 'express';
import Order from '../models/Order.model';
import { quoteOrder } from '../services/order-quote.service';
import {
    assertTransition,
    settlementFor,
    timestampFor,
} from '../services/order-lifecycle';
import { OrderStatus } from '../types/enums';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import Restaurant from '../models/Restaurant.model';
import { UserRole } from '../types/enums';
import User from '../models/User.model';

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
    // Legacy cash checkout remains supported; card checkout uses /payments/checkout.
    if (req.body.paymentMethod && req.body.paymentMethod !== 'cash') {
        throw new ApiError(400, 'Use Stripe checkout for card payments');
    }
    const quote = await quoteOrder(req.body);
    const order = await Order.create({
        ...quote,
        customer: req.user!.id,
        paymentMethod: 'cash',
        placedAt: new Date(),
        settlement: settlementFor(quote.subtotal, quote.deliveryFee),
    });
    res.status(201).json(ApiResponse.ok(order, 'Cash order placed'));
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
    const orders = await Order.find({ customer: req.user?.id })
        .populate('restaurant', 'name imageUrl')
        .sort({ createdAt: -1 });
    res.json(ApiResponse.ok(orders));
});

export const getOrderById = asyncHandler(
    async (req: Request, res: Response) => {
        // Authorize against the raw ObjectId. Populating `customer` first turns
        // this field into a document, whose string value is "[object Object]".
        // That caused legitimate customers to be rejected with 403.
        const order = await Order.findById(req.params.id);
        if (!order) throw new ApiError(404, 'Order not found');
        if (req.user?.role !== UserRole.ADMIN) {
            const isCustomer =
                req.user?.role === UserRole.CUSTOMER &&
                order.customer.toString() === req.user.id;
            const isRider =
                req.user?.role === UserRole.DELIVERY_RIDER &&
                order.deliveryRider?.toString() === req.user.id;
            const restaurant =
                req.user?.role === UserRole.RESTAURANT_OWNER &&
                (await Restaurant.findOne({
                    _id: order.restaurant,
                    owner: req.user?.id,
                }));
            if (!isCustomer && !isRider && !restaurant)
                throw new ApiError(403, 'Not authorized');
        }

        await order.populate('customer', 'name email phone');
        await order.populate('restaurant', 'name address phone');
        await order.populate('deliveryRider', 'name phone');
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
        }
        assertTransition(order.status, status, req.user!.role);
        if (
            order.paymentMethod === 'stripe_test' &&
            order.paymentStatus !== 'paid'
        ) {
            throw new ApiError(
                409,
                'Payment must be confirmed before processing'
            );
        }
        const changes: Record<string, unknown> = { status };
        const timestamp = timestampFor[status as OrderStatus];
        if (timestamp) {
            changes[timestamp] = new Date();
        }
        if (status === OrderStatus.DECLINED) {
            changes['settlement.restaurantStatus'] = 'cancelled';
            changes['settlement.riderStatus'] = 'cancelled';
        }
        const updated = await Order.findOneAndUpdate(
            { _id: order._id, status: order.status },
            { $set: changes },
            { new: true }
        );
        if (!updated) {
            throw new ApiError(409, 'Order changed. Refresh and try again.');
        }
        res.json(ApiResponse.ok(updated, `Status updated to ${status}`));
    }
);

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.customer.toString() !== req.user?.id)
        throw new ApiError(403, 'Not authorized');
    assertTransition(order.status, OrderStatus.CANCELLED, UserRole.CUSTOMER);
    const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: OrderStatus.PLACED },
        {
            $set: {
                status: OrderStatus.CANCELLED,
                cancelledAt: new Date(),
                'settlement.restaurantStatus': 'cancelled',
                'settlement.riderStatus': 'cancelled',
            },
        },
        { new: true }
    );
    if (!updated) {
        throw new ApiError(409, 'Order changed and can no longer be cancelled');
    }
    res.json(
        ApiResponse.ok(
            updated,
            'Order cancelled. Paid test orders require a test refund through support.'
        )
    );
});

export const reviewDelivery = asyncHandler(
    async (req: Request, res: Response) => {
        const {
            riderRating,
            serviceRating,
            restaurantRating,
            restaurantComment,
            comment,
        } = req.body;
        if (
            ![riderRating, serviceRating].every(
                (value) => Number.isInteger(value) && value >= 1 && value <= 5
            ) ||
            !Number.isInteger(restaurantRating) ||
            restaurantRating < 1 ||
            restaurantRating > 5 ||
            (comment !== undefined &&
                (typeof comment !== 'string' || comment.length > 2000)) ||
            typeof restaurantComment !== 'string' ||
            restaurantComment.trim().length < 1 ||
            restaurantComment.length > 2000
        ) {
            throw new ApiError(
                400,
                'Choose 1–5 stars for rider and service, with an optional comment up to 2000 characters'
            );
        }
        const owned = await Order.findOne({
            _id: req.params.id,
            customer: req.user!.id,
        }).select(
            'deliveryRider restaurant status customerReceipt deliveryReview'
        );
        if (
            !owned?.deliveryRider ||
            !(await User.exists({
                _id: owned.deliveryRider,
                role: UserRole.DELIVERY_RIDER,
            }))
        ) {
            throw new ApiError(409, 'This order has no rider to review');
        }
        if (
            owned.status !== OrderStatus.DELIVERED ||
            owned.customerReceipt?.status !== 'received'
        ) {
            throw new ApiError(
                409,
                'Confirm that you received the order before reviewing it'
            );
        }
        if (owned.deliveryReview)
            throw new ApiError(409, 'This order has already been reviewed');
        const Review = (await import('../models/Review.model')).default;
        const review = await Review.create({
            customer: req.user!.id,
            restaurant: owned.restaurant,
            order: owned._id,
            rating: restaurantRating,
            comment: restaurantComment.trim(),
        });
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                customer: req.user!.id,
                status: OrderStatus.DELIVERED,
                deliveryRider: { $exists: true, $ne: null },
                deliveryReview: { $exists: false },
                'customerReceipt.status': 'received',
            },
            {
                $set: {
                    deliveryReview: {
                        riderRating,
                        serviceRating,
                        comment,
                        createdAt: new Date(),
                    },
                },
            },
            { new: true, runValidators: true }
        );
        if (!order) {
            await review.deleteOne();
            throw new ApiError(
                409,
                'Only your delivered order with a rider can be reviewed, once'
            );
        }
        res.json(ApiResponse.ok(order, 'Delivery review saved'));
    }
);

export const updateCustomerReceipt = asyncHandler(
    async (req: Request, res: Response) => {
        const status = req.body.status;
        if (!['received', 'not_received'].includes(status))
            throw new ApiError(
                400,
                'Receipt status must be received or not_received'
            );
        const order = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                customer: req.user!.id,
                status: OrderStatus.DELIVERED,
            },
            { $set: { customerReceipt: { status, createdAt: new Date() } } },
            { new: true, runValidators: true }
        );
        if (!order)
            throw new ApiError(
                409,
                'Receipt confirmation is available only for delivered orders'
            );
        res.json(
            ApiResponse.ok(
                order,
                status === 'received'
                    ? 'Order receipt confirmed'
                    : 'Order marked as not received'
            )
        );
    }
);

export const getSalesAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
        const match: Record<string, unknown> = {
            status: OrderStatus.DELIVERED,
            'settlement.restaurantStatus': 'available',
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
                    revenue: { $sum: '$settlement.restaurantAmount' },
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
