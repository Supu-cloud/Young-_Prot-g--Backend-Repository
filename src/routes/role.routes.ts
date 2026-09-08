import { Router } from 'express';
import {
    reviewRoleApplication,
    getRiderProfile,
    setRiderAvailability,
    upsertOwnerProfile,
    upsertRiderProfile,
} from '../controllers/role.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.get(
    '/rider/profile',
    protect,
    authorize(UserRole.DELIVERY_RIDER),
    getRiderProfile
);
router.patch(
    '/applications/:userId',
    protect,
    authorize(UserRole.ADMIN),
    reviewRoleApplication
);
router.put(
    '/owner/profile',
    protect,
    authorize(UserRole.RESTAURANT_OWNER),
    upsertOwnerProfile
);
router.put(
    '/rider/profile',
    protect,
    authorize(UserRole.DELIVERY_RIDER),
    upsertRiderProfile
);
router.patch(
    '/rider/availability',
    protect,
    authorize(UserRole.DELIVERY_RIDER),
    setRiderAvailability
);
export default router;
