import { uploadSingle } from '../middleware/upload.middleware';
import { ApiError } from '../utils/ApiError';
import { Router } from 'express';
import {
    saveMyRestaurant,
    uploadRestaurantLogo,
    getOwnerAnalytics,
    getOwnerDashboard,
    getOwnerMenu,
    getOwnerMenuItem,
    getOwnerOrder,
    getOwnerOrders,
    getOwnerRestaurant,
} from '../controllers/owner.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.use(protect, authorize(UserRole.RESTAURANT_OWNER));
router.get('/dashboard', getOwnerDashboard);
router.get('/restaurant', getOwnerRestaurant);
router.put('/restaurant', saveMyRestaurant);
router.post(
    '/restaurant/logo',
    (req, res, next) => {
        uploadSingle(req, res, (error: unknown) => {
            if (!error) return next();
            const message =
                (error as { code?: string }).code === 'LIMIT_FILE_SIZE'
                    ? 'Choose an image no larger than 5 MB.'
                    : 'Choose one JPG, PNG or WebP image (up to 5 MB).';
            next(new ApiError(400, message, { imageUrl: message }));
        });
    },
    uploadRestaurantLogo
);
router.get('/menu', getOwnerMenu);
router.get('/menu/:id', getOwnerMenuItem);
router.get('/orders', getOwnerOrders);
router.get('/orders/:id', getOwnerOrder);
router.get('/analytics', getOwnerAnalytics);
export default router;
