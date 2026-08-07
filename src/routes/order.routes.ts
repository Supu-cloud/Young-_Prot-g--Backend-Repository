import { Router } from 'express';
import {
    placeOrder,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
    getSalesAnalytics,
} from '../controllers/order.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.post('/', protect, placeOrder);
router.get('/my', protect, getMyOrders);
router.get(
    '/analytics/sales',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    getSalesAnalytics
);
router.get(
    '/all',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    getAllOrders
);
router.get('/:id', protect, getOrderById);
router.patch(
    '/:id/status',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    updateOrderStatus
);
router.patch('/:id/cancel', protect, cancelOrder);
export default router;
