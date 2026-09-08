import { Router } from 'express';
import {
    getAllRestaurants,
    getRestaurantOptions,
    getRestaurantById,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    toggleRestaurantStatus,
} from '../controllers/restaurant.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.get('/', getAllRestaurants);
router.get('/options', getRestaurantOptions);
router.get('/:id', getRestaurantById);
const restaurantManagers = authorize(UserRole.RESTAURANT_OWNER);
router.post('/', protect, restaurantManagers, createRestaurant);
router.put('/:id', protect, restaurantManagers, updateRestaurant);
router.delete(
    '/:id',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    deleteRestaurant
);
router.patch(
    '/:id/toggle',
    protect,
    restaurantManagers,
    toggleRestaurantStatus
);
export default router;
