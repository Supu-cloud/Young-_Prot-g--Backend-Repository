import { Request, Response } from 'express';
import DeliveryAssignment, {
    DeliveryAssignmentStatus,
} from '../models/DeliveryAssignment.model';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import Order from '../models/Order.model';
import User from '../models/User.model';
import { AccountStatus, OrderStatus, UserRole } from '../types/enums';
import Restaurant from '../models/Restaurant.model';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const getAvailableRiders = asyncHandler(
    async (_req: Request, res: Response) => {
        const profiles = await DeliveryRiderProfile.find({ isAvailable: true })
            .populate({
                path: 'user',
                match: {
                    role: UserRole.DELIVERY_RIDER,
                    accountStatus: AccountStatus.APPROVED,
                },
                select: 'name phone',
            })
            .sort({ updatedAt: -1 });
        res.json(ApiResponse.ok(profiles.filter((profile) => profile.user)));
    }
);

export const assignRider = asyncHandler(async (req: Request, res: Response) => {
    const { riderId, payout = 0 } = req.body;
    if (typeof payout !== 'number' || payout < 0)
        throw new ApiError(400, 'Payout must be a non-negative number');
    const rider = await User.findOne({
        _id: riderId,
        role: UserRole.DELIVERY_RIDER,
        accountStatus: AccountStatus.APPROVED,
    });
    if (!rider) throw new ApiError(404, 'Approved rider not found');
    const profile = await DeliveryRiderProfile.findOne({
        user: riderId,
        isAvailable: true,
    });
    if (!profile) throw new ApiError(400, 'Rider is not available');

    const order = await Order.findById(req.params.orderId);
    if (!order) throw new ApiError(404, 'Order not found');
    if (req.user?.role === UserRole.RESTAURANT_OWNER) {
        const ownsRestaurant = await Restaurant.exists({
            _id: order.restaurant,
            owner: req.user.id,
        });
        if (!ownsRestaurant)
            throw new ApiError(403, 'This order is not for your restaurant');
    }
    if (order.status !== OrderStatus.READY_FOR_PICKUP)
        throw new ApiError(400, 'Order must be ready for pickup');
    const activeAssignment = await DeliveryAssignment.exists({
        order: order._id,
        status: {
            $in: [
                DeliveryAssignmentStatus.ASSIGNED,
                DeliveryAssignmentStatus.ACCEPTED,
                DeliveryAssignmentStatus.PICKED_UP,
            ],
        },
    });
    if (activeAssignment)
        throw new ApiError(409, 'Order already has an active rider');

    const assignment = await DeliveryAssignment.create({
        order: order._id,
        rider: rider._id,
        payout,
    });
    order.deliveryRider = rider._id;
    order.status = OrderStatus.RIDER_ASSIGNED;
    await order.save();
    profile.isAvailable = false;
    await profile.save();
    res.status(201).json(ApiResponse.ok(assignment, 'Rider assigned'));
});

export const getMyDeliveries = asyncHandler(
    async (req: Request, res: Response) => {
        const assignments = await DeliveryAssignment.find({
            rider: req.user?.id,
        })
            .populate({
                path: 'order',
                populate: [
                    { path: 'restaurant', select: 'name address phone' },
                    { path: 'customer', select: 'name phone' },
                ],
            })
            .sort({ createdAt: -1 });
        res.json(ApiResponse.ok(assignments));
    }
);

export const getMyEarnings = asyncHandler(
    async (req: Request, res: Response) => {
        const from = req.query.from
            ? new Date(String(req.query.from))
            : undefined;
        const match: Record<string, unknown> = {
            rider: req.user?.id,
            status: DeliveryAssignmentStatus.DELIVERED,
        };
        if (from && !Number.isNaN(from.getTime()))
            match.deliveredAt = { $gte: from };
        const trips = await DeliveryAssignment.find(match)
            .populate('order', 'totalAmount restaurant deliveryAddress')
            .sort({ deliveredAt: -1 });
        const totalEarnings = trips.reduce((sum, trip) => sum + trip.payout, 0);
        res.json(
            ApiResponse.ok({
                totalEarnings,
                completedTrips: trips.length,
                trips,
            })
        );
    }
);

export const updateMyDeliveryStatus = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = req.body as { status: DeliveryAssignmentStatus };
        const assignment = await DeliveryAssignment.findOne({
            _id: req.params.id,
            rider: req.user?.id,
        });
        if (!assignment) throw new ApiError(404, 'Delivery not found');

        const allowedNext: Partial<
            Record<DeliveryAssignmentStatus, DeliveryAssignmentStatus[]>
        > = {
            [DeliveryAssignmentStatus.ASSIGNED]: [
                DeliveryAssignmentStatus.ACCEPTED,
                DeliveryAssignmentStatus.REJECTED,
            ],
            [DeliveryAssignmentStatus.ACCEPTED]: [
                DeliveryAssignmentStatus.PICKED_UP,
            ],
            [DeliveryAssignmentStatus.PICKED_UP]: [
                DeliveryAssignmentStatus.DELIVERED,
            ],
        };
        if (!allowedNext[assignment.status]?.includes(status))
            throw new ApiError(400, 'Invalid delivery status transition');

        assignment.status = status;
        const now = new Date();
        if (status === DeliveryAssignmentStatus.ACCEPTED)
            assignment.acceptedAt = now;
        if (status === DeliveryAssignmentStatus.PICKED_UP)
            assignment.pickedUpAt = now;
        if (status === DeliveryAssignmentStatus.DELIVERED)
            assignment.deliveredAt = now;
        await assignment.save();

        const orderStatus: Partial<
            Record<DeliveryAssignmentStatus, OrderStatus>
        > = {
            [DeliveryAssignmentStatus.ACCEPTED]: OrderStatus.RIDER_ASSIGNED,
            [DeliveryAssignmentStatus.PICKED_UP]: OrderStatus.OUT_FOR_DELIVERY,
            [DeliveryAssignmentStatus.DELIVERED]: OrderStatus.DELIVERED,
            [DeliveryAssignmentStatus.REJECTED]: OrderStatus.READY_FOR_PICKUP,
        };
        await Order.findByIdAndUpdate(assignment.order, {
            status: orderStatus[status],
            ...(status === DeliveryAssignmentStatus.REJECTED
                ? { $unset: { deliveryRider: 1 } }
                : {}),
        });
        if (
            status === DeliveryAssignmentStatus.DELIVERED ||
            status === DeliveryAssignmentStatus.REJECTED
        )
            await DeliveryRiderProfile.findOneAndUpdate(
                { user: req.user?.id },
                { isAvailable: true }
            );

        res.json(ApiResponse.ok(assignment, 'Delivery status updated'));
    }
);
