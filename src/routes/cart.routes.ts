import { Router } from 'express';
import {
    addCartItem,
    clearCart,
    getCart,
    removeCartItem,
    updateCartItem,
} from '../controllers/cart.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.use(protect, authorize(UserRole.CUSTOMER));
router.get('/', getCart);
router.post('/items', addCartItem);
router.patch('/items/:menuItemId', updateCartItem);
router.delete('/items/:menuItemId', removeCartItem);
router.delete('/', clearCart);
export default router;
