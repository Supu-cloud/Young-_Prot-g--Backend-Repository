import { Router } from 'express';
import {
    approveApplication,
    assignRestaurantOwner,
    deleteUser,
    generateReport,
    getAnalytics,
    getApplication,
    getDashboard,
    getOrder,
    getRestaurant,
    getUser,
    listApplications,
    listAssignableRestaurantOwners,
    listOrders,
    listRestaurants,
    listUsers,
    rejectApplication,
    updateUserStatus,
    unassignRestaurantOwner,
} from '../controllers/admin.controller';
import { authorize, protect } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();
router.use(protect, authorize(UserRole.ADMIN));

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/applications', listApplications);
router.get('/applications/:id', getApplication);
router.patch('/applications/:id/approve', approveApplication);
router.patch('/applications/:id/reject', rejectApplication);
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/status', updateUserStatus);
router.get('/restaurants', listRestaurants);
router.get('/restaurant-owners/assignable', listAssignableRestaurantOwners);
router.get('/restaurants/:id', getRestaurant);
router.patch('/restaurants/:id/owner', assignRestaurantOwner);
router.delete('/restaurants/:id/owner', unassignRestaurantOwner);
router.get('/orders', listOrders);
router.get('/orders/:id', getOrder);
router.get('/reports/:type', generateReport);

export default router;
