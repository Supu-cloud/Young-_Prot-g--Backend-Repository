import { Router } from 'express';
import { getReviews, addReview, deleteReview } from '../controllers/review.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.get('/:restaurantId', getReviews);
router.post('/',             protect, addReview);
router.delete('/:id',        protect, deleteReview);
export default router;