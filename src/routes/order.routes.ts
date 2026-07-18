import { Router } from 'express';
import { placeOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus, cancelOrder } from '../controllers/order.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();
router.post('/',            protect, placeOrder);
router.get('/my',           protect, getMyOrders);
router.get('/all',          protect, adminOnly, getAllOrders);
router.get('/:id',          protect, getOrderById);
router.patch('/:id/status', protect, adminOnly, updateOrderStatus);
router.patch('/:id/cancel', protect, cancelOrder);
export default router;