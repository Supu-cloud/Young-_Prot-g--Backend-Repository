import Cart from '../models/Cart.model';
import DeliveryAssignment from '../models/DeliveryAssignment.model';
import DeliveryRiderProfile from '../models/DeliveryRiderProfile.model';
import Order from '../models/Order.model';
import Restaurant from '../models/Restaurant.model';
import RestaurantOwnerProfile from '../models/RestaurantOwnerProfile.model';
import Review from '../models/Review.model';
import User from '../models/User.model';
import { UserRole } from '../types/enums';
import { ApiError } from '../utils/ApiError';

export const deleteUserAndSafeDependencies = async (
    userId: string,
    requestingUserId?: string
): Promise<void> => {
    if (userId === requestingUserId) {
        throw new ApiError(
            409,
            'Administrators cannot delete their own account'
        );
    }

    const user = await User.findById(userId).select('_id role');
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    if (user.role === UserRole.ADMIN) {
        throw new ApiError(
            403,
            'Administrator accounts cannot be deleted here'
        );
    }

    const [restaurants, customerOrders, riderOrders, reviews, assignments] =
        await Promise.all([
            Restaurant.countDocuments({ owner: user._id }),
            Order.countDocuments({ customer: user._id }),
            Order.countDocuments({ deliveryRider: user._id }),
            Review.countDocuments({ customer: user._id }),
            DeliveryAssignment.countDocuments({ rider: user._id }),
        ]);

    if (
        restaurants ||
        customerOrders ||
        riderOrders ||
        reviews ||
        assignments
    ) {
        throw new ApiError(
            409,
            'User cannot be permanently deleted because operational records reference this account. Suspend the account instead.'
        );
    }

    await Promise.all([
        Cart.deleteMany({ customer: user._id }),
        RestaurantOwnerProfile.deleteMany({ user: user._id }),
        DeliveryRiderProfile.deleteMany({ user: user._id }),
    ]);

    await user.deleteOne();
};
