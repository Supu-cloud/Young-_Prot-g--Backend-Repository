import { Router } from 'express';
import {
    confirmPayment,
    startPayment,
} from '../controllers/payment.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';
import {
    startCheckout,
    completeCheckout,
} from '../controllers/checkout.controller';

const router = Router();
router.post('/checkout', protect, authorize(UserRole.CUSTOMER), startCheckout);
router.post(
    '/checkout/:id/complete',
    protect,
    authorize(UserRole.CUSTOMER),
    completeCheckout
);
router.post(
    '/orders/:orderId/intent',
    protect,
    authorize(UserRole.CUSTOMER),
    startPayment
);
router.post(
    '/orders/:orderId/confirm',
    protect,
    authorize(UserRole.CUSTOMER),
    confirmPayment
);
export default router;
