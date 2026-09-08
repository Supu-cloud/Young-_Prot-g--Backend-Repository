/** Explicit opt-in integration demo. Creates ONE paid Stripe TEST order using
 * existing approved accounts. Never seeds, clears carts, deletes or resets data.
 * Tokens stay in memory; it does not test password login or browser card entry.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import User from '../src/models/User.model';
import Restaurant from '../src/models/Restaurant.model';
import MenuItem from '../src/models/MenuItem.model';
import Profile from '../src/models/DeliveryRiderProfile.model';
import Order from '../src/models/Order.model';
import Assignment from '../src/models/DeliveryAssignment.model';
import { createTokenPair } from '../src/services/token.service';
import orderRoutes from '../src/routes/order.routes';
import paymentRoutes from '../src/routes/payment.routes';
import deliveryRoutes from '../src/routes/delivery.routes';
import ownerRoutes from '../src/routes/owner.routes';
import roleRoutes from '../src/routes/role.routes';
import { UserRole } from '../src/types/enums';

async function main() {
    if (!process.argv.includes('--create-test-order')) throw new Error('Pass --create-test-order to explicitly run the real demo');
    if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? '')) throw new Error('Stripe test mode required');
    let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
    let profile: any; let originalAvailability = false; let demoOrderId = ''; let paid = false;
    let availabilityChanged = false;
    const checks: string[] = [];
    try {
        await mongoose.connect(process.env.MONGO_URI!, { serverSelectionTimeoutMS: 10000, autoIndex: false });
        const users = await User.find({ accountStatus: 'approved', isEmailVerified: true });
        const customer = users.find(u => u.role === UserRole.CUSTOMER);
        const otherCustomer = users.find(u => u.role === UserRole.CUSTOMER && String(u._id) !== String(customer?._id));
        const rider = users.find(u => u.role === UserRole.DELIVERY_RIDER);
        assert.ok(customer && rider, 'Approved customer and rider required');
        const owners = users.filter(u => u.role === UserRole.RESTAURANT_OWNER);
        const restaurants = await Restaurant.find({ owner: { $in: owners.map(u => u._id) }, isOpen: true });
        const menu = await MenuItem.findOne({ restaurant: { $in: restaurants.map(r => r._id) }, available: true, price: { $gt: 0 } });
        assert.ok(menu, 'An available real menu item and owned open restaurant are required');
        const restaurant = restaurants.find(r => String(r._id) === String(menu.restaurant))!;
        const owner = owners.find(u => String(u._id) === String(restaurant.owner))!;
        const wrongOwner = owners.find(u => String(u._id) !== String(owner._id));
        profile = await Profile.findOne({ user: rider._id });
        assert.ok(profile, 'Rider profile required');
        assert.equal(await Order.countDocuments({ deliveryRider: rider._id, status: { $in: ['rider_assigned', 'picked_up', 'out_for_delivery'] } }), 0, 'Existing rider is busy; do not disturb their delivery');
        originalAvailability = profile.isAvailable;
        const app = express(); app.use(express.json());
        app.use('/orders', orderRoutes); app.use('/payments', paymentRoutes); app.use('/deliveries', deliveryRoutes); app.use('/owner', ownerRoutes); app.use('/roles', roleRoutes);
        app.use((error: any, _req: any, res: any, _next: any) => { res.status(error.statusCode ?? 500).json({ message: error.statusCode ? error.message : 'Internal error during demo' }); });
        server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
        const port = (server.address() as { port: number }).port;
        const request = async (user: any, path: string, method = 'GET', body?: unknown, expected = 200): Promise<any> => {
            const token = createTokenPair({ userId: String(user._id), role: user.role }).accessToken;
            const response = await fetch(`http://127.0.0.1:${port}${path}`, { method,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body) });
            const payload = await response.json() as any;
            assert.equal(response.status, expected, `${method} ${path}: ${payload.message ?? 'Unexpected status'}`);
            return payload.data;
        };
        const checkoutKey = `demo-${crypto.randomUUID()}`;
        const checkout = await request(customer, '/payments/checkout', 'POST', { checkoutKey, restaurant: String(restaurant._id),
            items: [{ menuItem: String(menu._id), quantity: 1, price: 1 }], deliveryAddress: 'Foodie TEST demonstration — no physical delivery', note: 'Automated lifecycle verification; Stripe TEST MODE; internal earnings only' });
        demoOrderId = checkout.checkoutId;
        assert.equal(await Order.countDocuments({ _id: demoOrderId }), 0);
        const resumed = await request(customer, '/payments/checkout', 'POST', { checkoutKey });
        assert.equal(resumed.paymentIntentId, checkout.paymentIntentId);
        checks.push('Server pricing and durable checkout recovery before order creation');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 15000, maxNetworkRetries: 1 });
        const intent = await stripe.paymentIntents.confirm(checkout.paymentIntentId, { payment_method: 'pm_card_visa', return_url: 'https://example.com/foodie-test-return' });
        assert.equal(intent.livemode, false); assert.equal(intent.status, 'succeeded'); paid = true;
        const originalUpdate = Order.findOneAndUpdate;
        // Exercise payment-success/order-save-failure using the real successful
        // PaymentIntent. Restore persistence immediately, then recover the same ID.
        (Order as any).findOneAndUpdate = () => { throw new Error('Deliberate demo save failure'); };
        try { await request(customer, `/payments/checkout/${demoOrderId}/complete`, 'POST', {}, 500); }
        finally { Order.findOneAndUpdate = originalUpdate; }
        const created = await request(customer, `/payments/checkout/${demoOrderId}/complete`, 'POST', {});
        assert.equal(created.status, 'placed'); assert.equal(created.paymentStatus, 'paid');
        const duplicates = await Promise.all([1,2,3].map(() => request(customer, `/payments/checkout/${demoOrderId}/complete`, 'POST', {})));
        assert.ok(duplicates.every(order => order._id === demoOrderId));
        assert.equal(await Order.countDocuments({ _id: demoOrderId }), 1);
        checks.push('Real Stripe TEST payment, simulated save failure, retry, concurrent order recovery');
        if (wrongOwner) { await request(wrongOwner, `/orders/${demoOrderId}/status`, 'PATCH', { status: 'confirmed' }, 403); }
        if (otherCustomer) { await request(otherCustomer, `/orders/${demoOrderId}`, 'GET', undefined, 403); }
        await request(rider, `/orders/${demoOrderId}`, 'GET', undefined, 403);
        await request(owner, `/orders/${demoOrderId}/status`, 'PATCH', { status: 'delivered' }, 409);
        assert.ok((await request(owner, '/owner/orders')).some((o: any) => o._id === demoOrderId));
        for (const status of ['confirmed', 'preparing', 'ready_for_pickup']) {
            await request(owner, `/orders/${demoOrderId}/status`, 'PATCH', { status });
            assert.equal((await request(customer, `/orders/${demoOrderId}`)).status, status);
        }
        await request(customer, `/orders/${demoOrderId}/cancel`, 'PATCH', {}, 409);
        if (!originalAvailability) {
            await request(owner, `/deliveries/orders/${demoOrderId}/assign`, 'POST', { riderId: String(rider._id) }, 409);
            await request(rider, '/roles/rider/availability', 'PATCH', { isAvailable: true }); availabilityChanged = true;
        }
        const assigned = await request(owner, `/deliveries/orders/${demoOrderId}/assign`, 'POST', { riderId: String(rider._id), payout: 999999 });
        assert.equal(assigned.payout, created.deliveryFee);
        assert.ok((await request(rider, '/deliveries/my')).some((d: any) => d.order._id === demoOrderId));
        await request(rider, `/deliveries/${assigned._id}/status`, 'PATCH', { status: 'preparing' }, 409);
        checks.push('Owner isolation, owner processing, unavailable rider rejection and real assignment');
        const beforeEarnings = await request(rider, '/deliveries/my/earnings');
        for (const status of ['picked_up', 'out_for_delivery', 'delivered']) {
            await request(rider, `/deliveries/${assigned._id}/status`, 'PATCH', { status });
            const tracking = await request(customer, `/orders/${demoOrderId}`);
            assert.equal(tracking.status, status);
            if (status !== 'delivered') assert.equal(tracking.settlement.riderStatus, 'pending');
        }
        const saved = await Order.findById(demoOrderId).select('+paymentIntentId');
        assert.ok(saved);
        for (const field of ['placedAt','confirmedAt','preparingAt','readyForPickupAt','riderAssignedAt','pickedUpAt','outForDeliveryAt','deliveredAt']) assert.ok(saved.get(field), field);
        assert.equal(String(saved.deliveryRider), String(rider._id)); assert.equal(saved.paymentIntentId, checkout.paymentIntentId);
        const deliveredAt = saved.deliveredAt!.getTime();
        await Promise.all([1,2,3].map(() => request(rider, `/deliveries/${assigned._id}/status`, 'PATCH', { status: 'delivered' })));
        const again = await Order.findById(demoOrderId);
        assert.equal(again!.deliveredAt!.getTime(), deliveredAt);
        const afterEarnings = await request(rider, '/deliveries/my/earnings');
        assert.equal(afterEarnings.totalEarnings - beforeEarnings.totalEarnings, saved.deliveryFee);
        assert.equal(saved.settlement!.restaurantAmount, saved.subtotal);
        assert.equal(saved.settlement!.restaurantStatus, 'available');
        assert.equal(await Assignment.countDocuments({ order: demoOrderId }), 1);
        const analytics = await request(owner, '/owner/analytics');
        assert.ok(analytics.recentSales.some((o: any) => o._id === demoOrderId));
        await request(customer, `/orders/${demoOrderId}/delivery-review`, 'POST', { riderRating: 5, serviceRating: 5, comment: 'Automated Stripe TEST lifecycle verification' });
        await request(customer, `/orders/${demoOrderId}/delivery-review`, 'POST', { riderRating: 5, serviceRating: 5 }, 409);
        checks.push('Rider progress, customer tracking, all timestamps, one assignment, internal earnings and idempotent delivery');
        checks.push('Customer delivery review and duplicate review rejection');
        console.log(JSON.stringify({ passed: true, orderId: demoOrderId, paymentMode: 'Stripe TEST', checks }, null, 2));
    } catch (error) {
        console.log(JSON.stringify({ passed: false, orderId: demoOrderId || undefined, paymentSucceeded: paid,
            error: error instanceof assert.AssertionError ? error.message : 'Demo could not complete; inspect connectivity/configuration without logging credentials', checks }));
        process.exitCode = 1;
    } finally {
        // Restore only the availability touched by this demo, and never free a
        // rider if a partially completed demo still has an active assignment.
        if (profile && (availabilityChanged || originalAvailability)) {
            const active = await Order.exists({ deliveryRider: profile.user, status: { $in: ['rider_assigned','picked_up','out_for_delivery'] } });
            if (!active) await Profile.updateOne({ _id: profile._id }, { $set: { isAvailable: originalAvailability } });
        }
        if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
        await mongoose.disconnect();
    }
}
void main();
