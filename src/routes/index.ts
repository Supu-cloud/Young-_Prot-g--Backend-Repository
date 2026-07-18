import { Router } from 'express';
import authRoutes       from './auth.routes';
import userRoutes       from './user.routes';
import restaurantRoutes from './restaurant.routes';
import menuRoutes       from './menu.routes';
import orderRoutes      from './order.routes';
import reviewRoutes     from './review.routes';

const router = Router();
router.use('/auth',        authRoutes);
router.use('/users',       userRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/menu',        menuRoutes);
router.use('/orders',      orderRoutes);
router.use('/reviews',     reviewRoutes);
export default router;