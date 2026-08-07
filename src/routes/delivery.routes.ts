import { Router } from 'express';
import {
    assignRider,
    getAvailableRiders,
    getMyDeliveries,
    updateMyDeliveryStatus,
    getMyEarnings,
} from '../controllers/delivery.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.get(
    '/available-riders',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    getAvailableRiders
);
router.post(
    '/orders/:orderId/assign',
    protect,
    authorize(UserRole.ADMIN, UserRole.RESTAURANT_OWNER),
    assignRider
);
router.get('/my', protect, authorize(UserRole.DELIVERY_RIDER), getMyDeliveries);
router.get(
    '/my/earnings',
    protect,
    authorize(UserRole.DELIVERY_RIDER),
    getMyEarnings
);
router.patch(
    '/:id/status',
    protect,
    authorize(UserRole.DELIVERY_RIDER),
    updateMyDeliveryStatus
);
export default router;
