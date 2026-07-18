import { Router } from 'express';
import { getProfile, updateProfile, changePassword, getAllUsers, deleteUser } from '../controllers/user.controller';
import { protect, adminOnly } from '../middleware/auth.middleware';

const router = Router();
router.get('/profile',    protect, getProfile);
router.put('/profile',    protect, updateProfile);
router.patch('/password', protect, changePassword);
router.get('/',           protect, adminOnly, getAllUsers);
router.delete('/:id',     protect, adminOnly, deleteUser);
export default router;