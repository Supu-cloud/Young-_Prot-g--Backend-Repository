import { Router } from 'express';
import {
    signup,
    login,
    getMe,
    signupRestaurantOwner,
    signupDeliveryRider,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.post('/signup', signup);
router.post('/signup/restaurant-owner', signupRestaurantOwner);
router.post('/signup/delivery-rider', signupDeliveryRider);
router.post('/login', login);
router.get('/me', protect, getMe);
export default router;
