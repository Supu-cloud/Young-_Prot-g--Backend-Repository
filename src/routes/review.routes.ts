import { Router } from 'express';
import {
    getReviews,
    addReview,
    deleteReview,
    getFeaturedReviews,
    getFeedbacks,
} from '../controllers/review.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.get('/', getFeedbacks);
router.get('/featured', getFeaturedReviews);
router.get('/:restaurantId', getReviews);
router.post('/', protect, addReview);
router.delete('/:id', protect, deleteReview);
export default router;
