import { Router } from 'express';
import {
    getMenuByRestaurant,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
} from '../controllers/menu.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();
router.get('/restaurant/:restaurantId', getMenuByRestaurant);
router.get('/item/:id', getMenuItemById);
router.post('/', protect, adminOnly, createMenuItem);
router.put('/:id', protect, adminOnly, updateMenuItem);
router.delete('/:id', protect, adminOnly, deleteMenuItem);
router.patch('/:id/toggle', protect, adminOnly, toggleAvailability);
export default router;
