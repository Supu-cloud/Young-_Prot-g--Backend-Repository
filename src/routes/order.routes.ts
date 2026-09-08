import { Router } from 'express';
import {
    placeOrder,
    reviewDelivery,
    updateCustomerReceipt,
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
router.post('/', protect, authorize(UserRole.CUSTOMER), placeOrder);
router.post(
    '/:id/delivery-review',
    protect,
    authorize(UserRole.CUSTOMER),
    reviewDelivery
);
router.patch(
    '/:id/receipt',
    protect,
    authorize(UserRole.CUSTOMER),
    updateCustomerReceipt
);
router.get('/my', protect, authorize(UserRole.CUSTOMER), getMyOrders);
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
router.patch('/:id/cancel', protect, authorize(UserRole.CUSTOMER), cancelOrder);
export default router;
