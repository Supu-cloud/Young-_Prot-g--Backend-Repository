import { Request, Response } from 'express';
import mongoose, { FilterQuery, PipelineStage } from 'mongoose';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import Order from '../models/Order.model';
import Restaurant from '../models/Restaurant.model';
import RestaurantOwnerProfile from '../models/RestaurantOwnerProfile.model';
import User, { IUser } from '../models/User.model';
import { sendApplicationApprovalEmail } from '../services/email.service';
import { ensureRestaurantOwnerIndex } from '../services/owner-restaurant.service';
import { deleteUserAndSafeDependencies } from '../services/user-deletion.service';
import {
    AccountStatus,
    OrderStatus,
    PaymentStatus,
    UserRole,
} from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const DAY = 86400000;
const reviewRoles = [UserRole.RESTAURANT_OWNER, UserRole.DELIVERY_RIDER];
const safeUserFields =
    'name email role accountStatus phone address isEmailVerified reviewedBy reviewedAt rejectionReason createdAt updatedAt';
const startOfDay = (date = new Date()) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
};
const parseDateRange = (req: Request) => {
    const now = new Date();
    const range = String(req.query.range || '30d');
    const days =
        range === '7d' ? 7 : range === '90d' ? 90 : range === '12m' ? 365 : 30;
    const from = req.query.from
        ? new Date(String(req.query.from))
        : new Date(now.getTime() - (days - 1) * DAY);
    const to = req.query.to ? new Date(String(req.query.to)) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to)
        throw new ApiError(400, 'Invalid date range');
    to.setHours(23, 59, 59, 999);
    return { from: startOfDay(from), to, range };
};
const pagination = (req: Request) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    return { page, limit, skip: (page - 1) * limit };
};
const paged = <T>(items: T[], total: number, page: number, limit: number) => ({
    items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
});
const escapedSearch = (value: unknown) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeCsv = (value: unknown) =>
    '"' + String(value ?? '').replace(/"/g, '""') + '"';
const applicationData = async (user: IUser) => {
    const profile =
        user.role === UserRole.RESTAURANT_OWNER
            ? await RestaurantOwnerProfile.findOne({ user: user._id }).lean()
            : await DeliveryRiderProfile.findOne({ user: user._id }).lean();
    return { ...user.toJSON(), profile: profile || null };
};

export const getDashboard = asyncHandler(
    async (_req: Request, res: Response) => {
        const now = new Date(),
            today = startOfDay(now),
            week = new Date(now.getTime() - 7 * DAY),
            month = new Date(now.getFullYear(), now.getMonth(), 1);
        const revenueMatch = {
            status: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
        };
        const [
            totalUsers,
            roleCounts,
            totalRestaurants,
            openRestaurants,
            totalOrders,
            ordersToday,
            sales,
            salesToday,
            completedOrders,
            cancelledOrders,
            pendingApprovals,
            availableRiders,
            newUsersToday,
            newUsersWeek,
            newUsersMonth,
            orderStatus,
            topRestaurants,
            recentUsers,
            recentOrders,
        ] = await Promise.all([
            User.countDocuments(),
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
            Restaurant.countDocuments(),
            Restaurant.countDocuments({ isOpen: true }),
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalAmount' },
                        average: { $avg: '$totalAmount' },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { ...revenueMatch, createdAt: { $gte: today } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } },
            ]),
            Order.countDocuments({ status: OrderStatus.DELIVERED }),
            Order.countDocuments({ status: OrderStatus.CANCELLED }),
            User.countDocuments({
                role: { $in: reviewRoles },
                accountStatus: AccountStatus.PENDING,
            }),
            DeliveryRiderProfile.countDocuments({ isAvailable: true }),
            User.countDocuments({ createdAt: { $gte: today } }),
            User.countDocuments({ createdAt: { $gte: week } }),
            User.countDocuments({ createdAt: { $gte: month } }),
            Order.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: '$restaurant',
                        orders: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'restaurants',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'restaurant',
                    },
                },
                { $unwind: '$restaurant' },
                {
                    $project: {
                        _id: 0,
                        restaurantId: '$_id',
                        name: '$restaurant.name',
                        orders: 1,
                        revenue: 1,
                    },
                },
            ]),
            User.find()
                .select(safeUserFields)
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            Order.find()
                .populate('customer', 'name')
                .populate('restaurant', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
        ]);
        const roles = Object.fromEntries(
            roleCounts.map((item: { _id: string; count: number }) => [
                item._id,
                item.count,
            ])
        );
        res.json(
            ApiResponse.ok({
                generatedAt: now,
                definitions: {
                    totalSales: 'Delivered orders with paymentStatus paid',
                    salesToday: 'Delivered and paid orders created today',
                    averageOrderValue: 'Average delivered and paid order value',
                    availableRiders:
                        'Rider profiles currently marked available',
                },
                kpis: {
                    totalUsers,
                    totalCustomers: roles[UserRole.CUSTOMER] || 0,
                    totalRestaurantOwners:
                        roles[UserRole.RESTAURANT_OWNER] || 0,
                    totalDeliveryRiders: roles[UserRole.DELIVERY_RIDER] || 0,
                    totalRestaurants,
                    openRestaurants,
                    totalOrders,
                    ordersToday,
                    totalSales: sales[0]?.total || 0,
                    salesToday: salesToday[0]?.total || 0,
                    averageOrderValue: sales[0]?.average || 0,
                    completedOrders,
                    cancelledOrders,
                    pendingApprovals,
                    availableRiders,
                    newUsersToday,
                    newUsersThisWeek: newUsersWeek,
                    newUsersThisMonth: newUsersMonth,
                    activeOrders:
                        totalOrders - completedOrders - cancelledOrders,
                },
                userDistribution: roleCounts.map(
                    (item: { _id: string; count: number }) => ({
                        role: item._id,
                        count: item.count,
                    })
                ),
                orderStatusDistribution: orderStatus.map(
                    (item: { _id: string; count: number }) => ({
                        status: item._id,
                        count: item.count,
                    })
                ),
                topRestaurants,
                recentActivity: { users: recentUsers, orders: recentOrders },
            })
        );
    }
);

export const getAnalytics = asyncHandler(
    async (req: Request, res: Response) => {
        const { from, to, range } = parseDateRange(req);
        const dateMatch = { createdAt: { $gte: from, $lte: to } },
            dateFormat = range === '12m' ? '%Y-%m' : '%Y-%m-%d';
        const revenueMatch = {
            ...dateMatch,
            status: OrderStatus.DELIVERED,
            paymentStatus: PaymentStatus.PAID,
        };
        const [
            salesTrend,
            userGrowth,
            userDistribution,
            orderStatusDistribution,
            topRestaurants,
            gross,
            cancelled,
        ] = await Promise.all([
            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: dateFormat,
                                date: '$createdAt',
                            },
                        },
                        revenue: { $sum: '$totalAmount' },
                        orders: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1 } },
            ]),
            User.aggregate([
                { $match: dateMatch },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: {
                                    format: dateFormat,
                                    date: '$createdAt',
                                },
                            },
                            role: '$role',
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.date': 1 } },
                {
                    $project: {
                        _id: 0,
                        date: '$_id.date',
                        role: '$_id.role',
                        count: 1,
                    },
                },
            ]),
            User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $project: { _id: 0, role: '$_id', count: 1 } },
            ]),
            Order.aggregate([
                { $match: dateMatch },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        value: { $sum: '$totalAmount' },
                    },
                },
                { $project: { _id: 0, status: '$_id', count: 1, value: 1 } },
            ]),
            Order.aggregate([
                { $match: revenueMatch },
                {
                    $group: {
                        _id: '$restaurant',
                        orders: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' },
                    },
                },
                { $sort: { revenue: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'restaurants',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'restaurant',
                    },
                },
                { $unwind: '$restaurant' },
                {
                    $project: {
                        _id: 0,
                        restaurantId: '$_id',
                        name: '$restaurant.name',
                        orders: 1,
                        revenue: 1,
                    },
                },
            ]),
            Order.aggregate([
                {
                    $match: {
                        ...dateMatch,
                        status: { $ne: OrderStatus.CANCELLED },
                    },
                },
                {
                    $group: {
                        _id: null,
                        value: { $sum: '$totalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { ...dateMatch, status: OrderStatus.CANCELLED } },
                {
                    $group: {
                        _id: null,
                        value: { $sum: '$totalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);
        const completedRevenue = salesTrend.reduce(
            (sum: number, point: { revenue: number }) => sum + point.revenue,
            0
        );
        const completedOrders = salesTrend.reduce(
            (sum: number, point: { orders: number }) => sum + point.orders,
            0
        );
        res.json(
            ApiResponse.ok({
                range: { from, to, key: range },
                salesTrend,
                orderVolume: salesTrend.map(
                    (point: { date: string; orders: number }) => ({
                        date: point.date,
                        orders: point.orders,
                    })
                ),
                userGrowth,
                userDistribution,
                orderStatusDistribution,
                restaurantAnalytics: { topRestaurants },
                sales: {
                    grossOrderSales: gross[0]?.value || 0,
                    completedOrderRevenue: completedRevenue,
                    cancelledOrderValue: cancelled[0]?.value || 0,
                    averageOrderValue: completedOrders
                        ? completedRevenue / completedOrders
                        : 0,
                    orderCount: gross[0]?.count || 0,
                },
            })
        );
    }
);

export const listApplications = asyncHandler(
    async (req: Request, res: Response) => {
        const { page, limit, skip } = pagination(req);
        const filter: FilterQuery<IUser> = { role: { $in: reviewRoles } };
        if (req.query.status) filter.accountStatus = req.query.status;
        if (req.query.role) filter.role = req.query.role;
        if (req.query.search) {
            const search = escapedSearch(req.query.search);
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        const [users, total] = await Promise.all([
            User.find(filter)
                .select(safeUserFields)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(filter),
        ]);
        res.json(
            ApiResponse.ok(
                paged(
                    await Promise.all(users.map(applicationData)),
                    total,
                    page,
                    limit
                )
            )
        );
    }
);
export const getApplication = asyncHandler(
    async (req: Request, res: Response) => {
        const user = await User.findOne({
            _id: req.params.id,
            role: { $in: reviewRoles },
        }).select(safeUserFields);
        if (!user) throw new ApiError(404, 'Application not found');
        res.json(ApiResponse.ok(await applicationData(user)));
    }
);
const reviewApplication = (
    status: AccountStatus.APPROVED | AccountStatus.REJECTED
) =>
    asyncHandler(async (req: Request, res: Response) => {
        const user = await User.findOne({
            _id: req.params.id,
            role: { $in: reviewRoles },
        });
        if (!user) throw new ApiError(404, 'Application not found');
        if (user.accountStatus !== AccountStatus.PENDING)
            throw new ApiError(409, 'Application has already been reviewed');
        if (status === AccountStatus.APPROVED && !user.isEmailVerified)
            throw new ApiError(
                409,
                'The applicant must verify their email before approval'
            );
        const reason =
            typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (status === AccountStatus.REJECTED && !reason)
            throw new ApiError(400, 'Rejection reason is required');
        user.accountStatus = status;
        user.reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
        user.reviewedAt = new Date();
        user.rejectionReason =
            status === AccountStatus.REJECTED ? reason : undefined;
        await user.save();

        let approvalEmailSent: boolean | undefined;
        if (status === AccountStatus.APPROVED) {
            try {
                const roleLabel =
                    user.role === UserRole.RESTAURANT_OWNER
                        ? 'restaurant owner'
                        : 'delivery rider';
                await sendApplicationApprovalEmail(
                    user.email,
                    user.name,
                    roleLabel
                );
                approvalEmailSent = true;
            } catch (error) {
                approvalEmailSent = false;
                console.error('Application approval email delivery failed', {
                    userId: user._id.toString(),
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Unknown email delivery error',
                });
            }
        }

        const data = await applicationData(user);
        res.json(
            ApiResponse.ok(
                approvalEmailSent === undefined
                    ? data
                    : { ...data, approvalEmailSent },
                approvalEmailSent === false
                    ? 'Application approved, but the approval email could not be delivered'
                    : `Application ${status}`
            )
        );
    });
export const approveApplication = reviewApplication(AccountStatus.APPROVED);
export const rejectApplication = reviewApplication(AccountStatus.REJECTED);

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = pagination(req);
    const filter: FilterQuery<IUser> = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.accountStatus = req.query.status;
    if (req.query.search) {
        const search = escapedSearch(req.query.search);
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }
    const sortField = [
        'name',
        'email',
        'role',
        'accountStatus',
        'createdAt',
    ].includes(String(req.query.sort))
        ? String(req.query.sort)
        : 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
        User.find(filter)
            .select(safeUserFields)
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean(),
        User.countDocuments(filter),
    ]);
    res.json(ApiResponse.ok(paged(items, total, page, limit)));
});
export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id)
        .select(safeUserFields)
        .lean();
    if (!user) throw new ApiError(404, 'User not found');
    res.json(ApiResponse.ok(user));
});
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    await deleteUserAndSafeDependencies(req.params.id, req.user?.id);
    res.json(
        ApiResponse.ok(
            null,
            'User permanently deleted. The email address can now be registered again.'
        )
    );
});
export const updateUserStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const status = req.body.status as AccountStatus;
        if (![AccountStatus.APPROVED, AccountStatus.SUSPENDED].includes(status))
            throw new ApiError(400, 'Status must be approved or suspended');
        if (req.params.id === req.user?.id)
            throw new ApiError(
                409,
                'Administrators cannot change their own account status'
            );
        const user = await User.findById(req.params.id);
        if (!user) throw new ApiError(404, 'User not found');
        if (user.role === UserRole.ADMIN)
            throw new ApiError(
                403,
                'Administrator accounts cannot be managed here'
            );
        if (status === AccountStatus.APPROVED && !user.isEmailVerified)
            throw new ApiError(409, 'Email must be verified before activation');
        user.accountStatus = status;
        await user.save();
        if (
            status === AccountStatus.SUSPENDED &&
            user.role === UserRole.RESTAURANT_OWNER
        ) {
            await Restaurant.updateMany(
                { owner: user._id },
                { $set: { isOpen: false } }
            );
        }
        res.json(
            ApiResponse.ok(
                user,
                status === AccountStatus.SUSPENDED
                    ? 'User suspended'
                    : 'User reactivated'
            )
        );
    }
);

export const listRestaurants = asyncHandler(
    async (req: Request, res: Response) => {
        const { page, limit, skip } = pagination(req);
        const match: Record<string, unknown> = {};
        if (req.query.open === 'true' || req.query.open === 'false')
            match.isOpen = req.query.open === 'true';
        if (req.query.search)
            match.name = {
                $regex: escapedSearch(req.query.search),
                $options: 'i',
            };
        const pipeline: PipelineStage[] = [
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                },
            },
            { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'orders',
                    localField: '_id',
                    foreignField: 'restaurant',
                    as: 'orders',
                },
            },
            {
                $addFields: {
                    orderCount: { $size: '$orders' },
                    revenue: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$orders',
                                        as: 'order',
                                        cond: {
                                            $and: [
                                                {
                                                    $eq: [
                                                        '$$order.status',
                                                        OrderStatus.DELIVERED,
                                                    ],
                                                },
                                                {
                                                    $eq: [
                                                        '$$order.paymentStatus',
                                                        PaymentStatus.PAID,
                                                    ],
                                                },
                                            ],
                                        },
                                    },
                                },
                                as: 'order',
                                in: '$$order.totalAmount',
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    orders: 0,
                    'owner.password': 0,
                    'owner.emailVerificationToken': 0,
                    'owner.googleId': 0,
                },
            },
            { $sort: { createdAt: -1 } },
            {
                $facet: {
                    items: [{ $skip: skip }, { $limit: limit }],
                    total: [{ $count: 'count' }],
                },
            },
        ];
        const [result] = await Restaurant.aggregate(pipeline);
        res.json(
            ApiResponse.ok(
                paged(
                    result?.items || [],
                    result?.total[0]?.count || 0,
                    page,
                    limit
                )
            )
        );
    }
);
export const getRestaurant = asyncHandler(
    async (req: Request, res: Response) => {
        const restaurant = await Restaurant.findById(req.params.id)
            .populate('owner', safeUserFields)
            .lean();
        if (!restaurant) throw new ApiError(404, 'Restaurant not found');
        const [orderCount, sales] = await Promise.all([
            Order.countDocuments({ restaurant: restaurant._id }),
            Order.aggregate([
                {
                    $match: {
                        restaurant: restaurant._id,
                        status: OrderStatus.DELIVERED,
                        paymentStatus: PaymentStatus.PAID,
                    },
                },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
            ]),
        ]);
        res.json(
            ApiResponse.ok({
                ...restaurant,
                orderCount,
                revenue: sales[0]?.revenue || 0,
            })
        );
    }
);

export const listAssignableRestaurantOwners = asyncHandler(
    async (_req: Request, res: Response) => {
        const owners = await User.find({
            role: UserRole.RESTAURANT_OWNER,
            accountStatus: AccountStatus.APPROVED,
            isEmailVerified: true,
        })
            .select('name email phone accountStatus isEmailVerified')
            .sort({ name: 1 })
            .lean();
        res.json(ApiResponse.ok(owners));
    }
);

export const assignRestaurantOwner = asyncHandler(
    async (req: Request, res: Response) => {
        await ensureRestaurantOwnerIndex();
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) throw new ApiError(404, 'Restaurant not found');

        const ownerId =
            typeof req.body.ownerId === 'string' ? req.body.ownerId.trim() : '';
        if (!ownerId) throw new ApiError(400, 'Choose a restaurant owner');
        if (!mongoose.isValidObjectId(ownerId))
            throw new ApiError(400, 'Invalid owner ID');

        const owner = await User.findOne({
            _id: ownerId,
            role: UserRole.RESTAURANT_OWNER,
            accountStatus: AccountStatus.APPROVED,
            isEmailVerified: true,
        });
        if (!owner)
            throw new ApiError(
                409,
                'Owner must be email verified and approved'
            );

        restaurant.owner = owner._id;
        await restaurant.save();
        await restaurant.populate('owner', safeUserFields);
        res.json(ApiResponse.ok(restaurant, 'Restaurant owner assigned'));
    }
);

export const unassignRestaurantOwner = asyncHandler(
    async (req: Request, res: Response) => {
        await ensureRestaurantOwnerIndex();
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) throw new ApiError(404, 'Restaurant not found');
        restaurant.owner = undefined;
        restaurant.isOpen = false;
        await restaurant.save();
        res.json(
            ApiResponse.ok(
                restaurant,
                'Restaurant owner removed and restaurant closed'
            )
        );
    }
);

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = pagination(req);
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
        const { from, to } = parseDateRange(req);
        filter.createdAt = { $gte: from, $lte: to };
    }
    if (req.query.search) {
        const search = String(req.query.search);
        filter._id = mongoose.isValidObjectId(search)
            ? new mongoose.Types.ObjectId(search)
            : null;
    }
    const [items, total] = await Promise.all([
        Order.find(filter)
            .populate('customer', 'name email phone')
            .populate('restaurant', 'name address')
            .populate('deliveryRider', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Order.countDocuments(filter),
    ]);
    res.json(ApiResponse.ok(paged(items, total, page, limit)));
});
export const getOrder = asyncHandler(async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.id)
        .populate('customer', 'name email phone')
        .populate('restaurant', 'name address phone')
        .populate('deliveryRider', 'name phone')
        .lean();
    if (!order) throw new ApiError(404, 'Order not found');
    res.json(ApiResponse.ok(order));
});

export const generateReport = asyncHandler(
    async (req: Request, res: Response) => {
        const { from, to } = parseDateRange(req);
        const type = String(req.params.type),
            match = { createdAt: { $gte: from, $lte: to } };
        let rows: Record<string, unknown>[];
        if (type === 'sales' || type === 'orders') {
            const orders = await Order.find(match)
                .populate('customer', 'name email')
                .populate('restaurant', 'name')
                .sort({ createdAt: -1 })
                .lean();
            rows = orders.map((order) => ({
                orderId: order._id,
                createdAt: order.createdAt,
                customer:
                    typeof order.customer === 'object' &&
                    order.customer &&
                    'name' in order.customer
                        ? order.customer.name
                        : '',
                restaurant:
                    typeof order.restaurant === 'object' &&
                    order.restaurant &&
                    'name' in order.restaurant
                        ? order.restaurant.name
                        : '',
                status: order.status,
                paymentStatus: order.paymentStatus,
                totalAmount: order.totalAmount,
            }));
        } else if (
            ['customers', 'users', 'riders', 'approvals'].includes(type)
        ) {
            const userFilter: FilterQuery<IUser> = { ...match };
            if (type === 'customers') userFilter.role = UserRole.CUSTOMER;
            if (type === 'riders') userFilter.role = UserRole.DELIVERY_RIDER;
            if (type === 'approvals') userFilter.role = { $in: reviewRoles };
            rows = (await User.find(userFilter)
                .select(safeUserFields)
                .sort({ createdAt: -1 })
                .lean()) as unknown as Record<string, unknown>[];
        } else if (type === 'restaurants') {
            rows = (await Restaurant.find(match)
                .populate('owner', 'name email')
                .sort({ createdAt: -1 })
                .lean()) as unknown as Record<string, unknown>[];
        } else throw new ApiError(400, 'Unsupported report type');

        const summary = {
            records: rows.length,
            from,
            to,
            generatedAt: new Date(),
        };
        if (req.query.format === 'csv') {
            const keys = rows.length
                ? Object.keys(rows[0]).filter(
                      (key) => !['_id', '__v'].includes(key)
                  )
                : [];
            const csv = [
                keys.map(escapeCsv).join(','),
                ...rows.map((row) =>
                    keys.map((key) => escapeCsv(row[key])).join(',')
                ),
            ].join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${type}-report.csv"`
            );
            res.send(csv);
            return;
        }
        res.json(
            ApiResponse.ok({
                title: `${type[0].toUpperCase()}${type.slice(1)} report`,
                summary,
                rows,
            })
        );
    }
);
