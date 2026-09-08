import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    signup,
    login,
    getMe,
    signupRestaurantOwner,
    signupDeliveryRider,
    verifyEmail,
    googleAuth,
    refreshSession,
    resendVerificationEmail,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// High traffic සහ Brute-force ප්‍රහාර වලින් ආරක්ෂා වීමට Rate Limiter එකක්
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // විනාඩි 15යි
    max: 100, // IP එකකට උපරිම Requests 100යි
    message: {
        message: 'Too many requests, please try again after 15 minutes.',
    },
});

// Authentication Routes
router.post('/signup', authLimiter, signup);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerificationEmail);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.post('/refresh', authLimiter, refreshSession);

// Role Application Routes
router.post('/signup/restaurant-owner', authLimiter, signupRestaurantOwner);
router.post('/signup/delivery-rider', authLimiter, signupDeliveryRider);

// Protected User Profile Route
router.get('/me', protect, getMe);

export default router;
