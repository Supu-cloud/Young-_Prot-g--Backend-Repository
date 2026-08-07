import { Router } from 'express';
import { startPayment } from '../controllers/payment.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.post(
    '/orders/:orderId/intent',
    protect,
    authorize(UserRole.CUSTOMER),
    startPayment
);
export default router;
