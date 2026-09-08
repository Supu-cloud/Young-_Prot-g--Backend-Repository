import mongoose from 'mongoose';
import DeliveryAssignment, {
    DeliveryAssignmentStatus,
} from '../models/DeliveryAssignment.model';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import Order from '../models/Order.model';
import User from '../models/User.model';
import Restaurant from '../models/Restaurant.model';
import { AccountStatus, OrderStatus, UserRole } from '../types/enums';
import { assertTransition, timestampFor } from '../services/order-lifecycle';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const getAvailableRiders = asyncHandler(async (_req, res) => {
    const profiles = await DeliveryRiderProfile.find({
        isAvailable: true,
    }).populate({
        path: 'user',
        match: {
            role: UserRole.DELIVERY_RIDER,
            accountStatus: AccountStatus.APPROVED,
            isEmailVerified: true,
        },
        select: 'name phone',
    });
    res.json(ApiResponse.ok(profiles.filter((profile) => profile.user)));
});

export const assignRider = asyncHandler(async (req, res) => {
    const { riderId } = req.body;
    if (!mongoose.isValidObjectId(riderId)) {
        throw new ApiError(400, 'Choose a rider');
    }
    const assignment = await mongoose.connection.transaction(
        async (session) => {
            const order = await Order.findById(req.params.orderId).session(
                session
            );
            if (!order) {
                throw new ApiError(404, 'Order not found');
            }
            if (
                req.user!.role === UserRole.RESTAURANT_OWNER &&
                !(await Restaurant.exists({
                    _id: order.restaurant,
                    owner: req.user!.id,
                }).session(session))
            ) {
                throw new ApiError(
                    403,
                    'This order is not for your restaurant'
                );
            }
            // Safe replay when the successful assignment response was lost.
            if (
                order.status === OrderStatus.RIDER_ASSIGNED &&
                String(order.deliveryRider) === riderId
            ) {
                const existing = await DeliveryAssignment.findOne({
                    order: order._id,
                    rider: riderId,
                    status: { $in: ['assigned', 'accepted'] },
                }).session(session);
                if (existing) {
                    return existing;
                }
            }
            if (
                order.status !== OrderStatus.READY_FOR_PICKUP ||
                order.deliveryRider
            ) {
                throw new ApiError(409, 'Order must be ready and unassigned');
            }
            const rider = await User.exists({
                _id: riderId,
                role: UserRole.DELIVERY_RIDER,
                accountStatus: AccountStatus.APPROVED,
                isEmailVerified: true,
            }).session(session);
            if (!rider) {
                throw new ApiError(409, 'Approved rider not found');
            }
            const active = await Order.exists({
                deliveryRider: riderId,
                status: {
                    $in: ['rider_assigned', 'picked_up', 'out_for_delivery'],
                },
            }).session(session);
            if (active) {
                throw new ApiError(409, 'Rider already has an active delivery');
            }
            const profile = await DeliveryRiderProfile.findOneAndUpdate(
                { user: riderId, isAvailable: true },
                { $set: { isAvailable: false } },
                { new: true, session }
            );
            if (!profile) {
                throw new ApiError(
                    409,
                    'Rider is unavailable or has no profile'
                );
            }
            const now = new Date();
            order.deliveryRider = new mongoose.Types.ObjectId(riderId);
            order.status = OrderStatus.RIDER_ASSIGNED;
            order.riderAssignedAt = now;
            await order.save({ session });
            const [created] = await DeliveryAssignment.create(
                [
                    {
                        order: order._id,
                        rider: riderId,
                        payout: order.deliveryFee,
                        assignedAt: now,
                    },
                ],
                { session }
            );
            return created;
        }
    );
    res.json(ApiResponse.ok(assignment, 'Rider assigned'));
});

export const getMyDeliveries = asyncHandler(async (req, res) => {
    const assignments = await DeliveryAssignment.find({ rider: req.user!.id })
        .populate({
            path: 'order',
            match: { deliveryRider: req.user!.id },
            populate: [
                { path: 'restaurant', select: 'name address phone' },
                { path: 'customer', select: 'name phone' },
            ],
        })
        .sort({ createdAt: -1 });
    res.json(ApiResponse.ok(assignments.filter((item) => item.order)));
});

export const getMyEarnings = asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {
        deliveryRider: req.user!.id,
        status: OrderStatus.DELIVERED,
        'settlement.riderStatus': 'available',
    };
    if (req.query.from) {
        const from = new Date(String(req.query.from));
        if (Number.isNaN(from.getTime())) {
            throw new ApiError(400, 'Invalid earnings date');
        }
        filter.deliveredAt = { $gte: from };
    }
    const orders = await Order.find(filter)
        .populate('restaurant', 'name address')
        .sort({ deliveredAt: -1 });
    const trips = orders.map((order) => ({
        _id: order.id,
        order,
        rider: req.user!.id,
        status: 'delivered',
        payout: order.settlement!.riderAmount,
        assignedAt: order.riderAssignedAt,
        deliveredAt: order.deliveredAt,
    }));
    res.json(
        ApiResponse.ok({
            totalEarnings: trips.reduce((sum, trip) => sum + trip.payout, 0),
            completedTrips: trips.length,
            trips,
            description: 'Internal test ledger; no Stripe or bank payout',
        })
    );
});

export const updateMyDeliveryStatus = asyncHandler(async (req, res) => {
    const status = req.body.status as DeliveryAssignmentStatus;
    const result = await mongoose.connection.transaction(async (session) => {
        const assignment = await DeliveryAssignment.findOne({
            _id: req.params.id,
            rider: req.user!.id,
        }).session(session);
        if (!assignment) {
            throw new ApiError(404, 'Delivery not found');
        }
        const order = await Order.findOne({
            _id: assignment.order,
            deliveryRider: req.user!.id,
        }).session(session);
        if (!order) {
            throw new ApiError(403, 'This order is not assigned to you');
        }
        if (
            assignment.status === status &&
            (String(order.status) === status ||
                (status === DeliveryAssignmentStatus.ACCEPTED &&
                    order.status === OrderStatus.RIDER_ASSIGNED))
        ) {
            return assignment;
        }
        // Older pickup requests advanced the Order straight to out_for_delivery.
        // Reconcile the assignment without regressing or inventing order timestamps.
        if (
            assignment.status === DeliveryAssignmentStatus.PICKED_UP &&
            status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY &&
            order.status === OrderStatus.OUT_FOR_DELIVERY
        ) {
            assignment.status = status;
            assignment.outForDeliveryAt = order.outForDeliveryAt;
            await assignment.save({ session });
            return assignment;
        }
        const now = new Date();
        if (
            status === DeliveryAssignmentStatus.REJECTED ||
            status === DeliveryAssignmentStatus.ACCEPTED
        ) {
            if (
                assignment.status !== DeliveryAssignmentStatus.ASSIGNED ||
                order.status !== OrderStatus.RIDER_ASSIGNED
            ) {
                throw new ApiError(
                    409,
                    'Assignment can no longer be accepted or rejected'
                );
            }
            if (status === DeliveryAssignmentStatus.REJECTED) {
                order.deliveryRider = undefined;
                order.riderAssignedAt = undefined;
                order.status = OrderStatus.READY_FOR_PICKUP;
                await DeliveryRiderProfile.updateOne(
                    { user: req.user!.id },
                    { $set: { isAvailable: true } },
                    { session }
                );
            } else {
                assignment.acceptedAt = now;
            }
        } else if (status === DeliveryAssignmentStatus.FAILED) {
            if (
                ![
                    OrderStatus.RIDER_ASSIGNED,
                    OrderStatus.PICKED_UP,
                    OrderStatus.OUT_FOR_DELIVERY,
                ].includes(order.status)
            ) {
                throw new ApiError(
                    409,
                    'This delivery can no longer be marked as failed'
                );
            }
            order.status = OrderStatus.DELIVERY_FAILED;
            order.deliveryFailedAt = now;
            order.settlement = {
                restaurantAmount:
                    order.subtotal ?? order.totalAmount - order.deliveryFee,
                riderAmount: 0,
                restaurantStatus: 'cancelled',
                riderStatus: 'cancelled',
                availableAt: now,
            };
            assignment.failedAt = now;
            await DeliveryRiderProfile.updateOne(
                { user: req.user!.id },
                { $set: { isAvailable: true } },
                { session }
            );
        } else {
            assertTransition(
                order.status,
                status as unknown as OrderStatus,
                UserRole.DELIVERY_RIDER
            );
            order.status = status as unknown as OrderStatus;
            const field = timestampFor[order.status];
            if (field) {
                order.set(field, now);
            }
            if (status === DeliveryAssignmentStatus.PICKED_UP) {
                assignment.pickedUpAt = now;
            }
            if (status === DeliveryAssignmentStatus.OUT_FOR_DELIVERY) {
                assignment.outForDeliveryAt = now;
            }
            if (status === DeliveryAssignmentStatus.DELIVERED) {
                if (order.paymentStatus !== 'paid') {
                    throw new ApiError(
                        409,
                        'Payment must be confirmed before earnings become available'
                    );
                }
                assignment.deliveredAt = now;
                assignment.payout = order.deliveryFee;
                order.settlement = {
                    restaurantAmount:
                        order.subtotal ?? order.totalAmount - order.deliveryFee,
                    riderAmount: order.deliveryFee,
                    restaurantStatus: 'available',
                    riderStatus: 'available',
                    availableAt: now,
                };
                await DeliveryRiderProfile.updateOne(
                    { user: req.user!.id },
                    { $set: { isAvailable: true } },
                    { session }
                );
            }
        }
        assignment.status = status;
        await order.save({ session });
        await assignment.save({ session });
        return assignment;
    });
    res.json(ApiResponse.ok(result, 'Delivery updated'));
});
