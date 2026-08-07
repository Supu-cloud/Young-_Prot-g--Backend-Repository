import { Router } from 'express';
import {
    getMenuByRestaurant,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
} from '../controllers/menu.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.get('/restaurant/:restaurantId', getMenuByRestaurant);
router.get('/item/:id', getMenuItemById);
const menuManagers = authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER);
router.post('/', protect, menuManagers, createMenuItem);
router.put('/:id', protect, menuManagers, updateMenuItem);
router.delete('/:id', protect, menuManagers, deleteMenuItem);
router.patch('/:id/toggle', protect, menuManagers, toggleAvailability);
export default router;
