import { Request, Response } from 'express';
import mongoose from 'mongoose';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import RestaurantOwnerProfile from '../models/RestaurantOwnerProfile.model';
import User from '../models/User.model';
import Order from '../models/Order.model';
import { AccountStatus, UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const reviewRoleApplication = asyncHandler(
    async (req: Request, res: Response) => {
        const { status } = req.body;
        if (![AccountStatus.APPROVED, AccountStatus.REJECTED].includes(status))
            throw new ApiError(400, 'Status must be approved or rejected');

        const user = await User.findById(req.params.userId);
        if (
            !user ||
            ![UserRole.RESTAURANT_OWNER, UserRole.DELIVERY_RIDER].includes(
                user.role
            )
        )
            throw new ApiError(404, 'Role application not found');
        if (user.accountStatus !== AccountStatus.PENDING)
            throw new ApiError(409, 'Application has already been reviewed');
        const rejectionReason =
            typeof req.body.rejectionReason === 'string'
                ? req.body.rejectionReason.trim()
                : '';
        if (status === AccountStatus.REJECTED && !rejectionReason)
            throw new ApiError(400, 'Rejection reason is required');

        user.accountStatus = status;
        user.reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
        user.reviewedAt = new Date();
        user.rejectionReason =
            status === AccountStatus.REJECTED ? rejectionReason : undefined;
        await user.save();
        res.json(ApiResponse.ok(user, `Application ${status}`));
    }
);

export const upsertOwnerProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const { businessName, businessRegistrationNumber } = req.body;
        if (!businessName) throw new ApiError(400, 'Business name is required');
        const profile = await RestaurantOwnerProfile.findOneAndUpdate(
            { user: req.user?.id },
            { businessName, businessRegistrationNumber },
            { new: true, upsert: true, runValidators: true }
        );
        res.json(ApiResponse.ok(profile, 'Owner profile saved'));
    }
);

export const upsertRiderProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const {
            vehicleType,
            vehicleNumber,
            licenseNumber,
            verificationDocuments,
        } = req.body;
        if (!vehicleType || !vehicleNumber)
            throw new ApiError(400, 'Vehicle type and number are required');
        const profile = await DeliveryRiderProfile.findOneAndUpdate(
            { user: req.user?.id },
            {
                vehicleType,
                vehicleNumber,
                licenseNumber,
                verificationDocuments,
            },
            { new: true, upsert: true, runValidators: true }
        );
        res.json(ApiResponse.ok(profile, 'Rider profile saved'));
    }
);

export const setRiderAvailability = asyncHandler(
    async (req: Request, res: Response) => {
        if (typeof req.body.isAvailable !== 'boolean')
            throw new ApiError(400, 'isAvailable must be a boolean');
        if (
            req.body.isAvailable &&
            (await Order.exists({
                deliveryRider: req.user?.id,
                status: {
                    $in: ['rider_assigned', 'picked_up', 'out_for_delivery'],
                },
            }))
        ) {
            throw new ApiError(
                409,
                'Complete your active delivery before going available'
            );
        }
        const profile = await DeliveryRiderProfile.findOneAndUpdate(
            { user: req.user?.id },
            { isAvailable: req.body.isAvailable },
            { new: true, runValidators: true }
        );
        if (!profile) throw new ApiError(404, 'Create rider profile first');
        res.json(ApiResponse.ok(profile, 'Availability updated'));
    }
);

export const getRiderProfile = asyncHandler(
    async (req: Request, res: Response) => {
        const profile = await DeliveryRiderProfile.findOne({
            user: req.user?.id,
        }).populate('user', 'name email phone address role accountStatus');
        if (!profile) throw new ApiError(404, 'Create rider profile first');
        res.json(ApiResponse.ok(profile));
    }
);
