import { Router } from 'express';
import {
    getAllRestaurants,
    getRestaurantById,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    toggleRestaurantStatus,
} from '../controllers/restaurant.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();
router.get('/', getAllRestaurants);
router.get('/:id', getRestaurantById);
router.post('/', protect, adminOnly, createRestaurant);
router.put('/:id', protect, adminOnly, updateRestaurant);
router.delete('/:id', protect, adminOnly, deleteRestaurant);
router.patch('/:id/toggle', protect, adminOnly, toggleRestaurantStatus);
export default router;
