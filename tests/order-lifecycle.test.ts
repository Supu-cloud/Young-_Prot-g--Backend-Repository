import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import Order from '../src/models/Order.model';
import Restaurant from '../src/models/Restaurant.model';
import User from '../src/models/User.model';
import MenuItem from '../src/models/MenuItem.model';
import Profile from '../src/models/DeliveryRiderProfile.model';
import Assignment from '../src/models/DeliveryAssignment.model';
import Attempt from '../src/models/CheckoutAttempt.model';
import * as payments from '../src/services/payment.service';
import { assertTransition, settlementFor, timestampFor } from '../src/services/order-lifecycle';
import { quoteOrder } from '../src/services/order-quote.service';
import { startCheckout, completeCheckout } from '../src/controllers/checkout.controller';
import { updateOrderStatus, cancelOrder, getOrderById, reviewDelivery } from '../src/controllers/order.controller';
import { assignRider, updateMyDeliveryStatus, getMyEarnings, getMyDeliveries } from '../src/controllers/delivery.controller';
import { OrderStatus as S, UserRole as R } from '../src/types/enums';

// Controller tests substitute persistence and Stripe only. They do not connect to,
// seed, reset, or delete any database. Real transaction behavior is tested separately.
const customer = new mongoose.Types.ObjectId();
const owner = new mongoose.Types.ObjectId();
const rider = new mongoose.Types.ObjectId();
const stranger = new mongoose.Types.ObjectId();
const restaurant = new mongoose.Types.ObjectId();
const menu = new mongoose.Types.ObjectId();
let order: any;
let assignment: any;
let available: boolean;
let writes: number;
let failSave: boolean;
let attempt: any;
let intent: any;
const query = (value: any): any => ({ then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject),
    select() { return this; }, populate() { return this; }, sort() { return this; }, session() { return this; } });
const matches = (value: any, filter: any) => Object.entries(filter).every(([key, expected]: [string, any]) => {
    const actual = key.split('.').reduce((v, field) => v?.[field], value);
    if (expected && typeof expected === 'object' && !(expected instanceof mongoose.Types.ObjectId)) {
        if ('$in' in expected && !expected.$in.includes(actual)) return false;
        if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
        if ('$ne' in expected && String(actual) === String(expected.$ne)) return false;
        return true;
    }
    return String(actual) === String(expected);
});
const patch = (doc: any, values: any) => { for (const [key, value] of Object.entries(values)) {
    if (key.includes('.')) { const [parent, field] = key.split('.'); doc[parent] ??= {}; doc[parent][field] = value; }
    else doc[key] = value;
} };
const hydrateOrder = (values: any) => ({ ...values, id: String(values._id),
    set(field: string, value: any) { this[field] = value; },
    async save() { writes++; order = this; return this; }, async populate() { return this; } });

beforeEach(() => {
    order = hydrateOrder({ _id: new mongoose.Types.ObjectId(), customer, restaurant,
        items: [{ menuItem: menu, name: 'Rice', price: 500, quantity: 2 }], subtotal: 1000, deliveryFee: 350, totalAmount: 1350,
        status: S.PLACED, paymentStatus: 'paid', paymentMethod: 'stripe_test', deliveryAddress: 'Demo address',
        placedAt: new Date(), settlement: settlementFor(1000, 350) });
    assignment = null; available = true; writes = 0; failSave = false; attempt = null;
    intent = { id: 'pi_test_fixture', status: 'succeeded', livemode: false, amount_received: 135000, currency: 'lkr', metadata: {}, client_secret: 'test_fixture_only' };
    mock.method(mongoose.connection, 'transaction', async (fn: any) => fn({}));
    mock.method(Order, 'findById', (id: any) => query(order && String(order._id) === String(id) ? order : null));
    mock.method(Order, 'findOne', (filter: any) => query(order && matches(order, filter) ? order : null));
    mock.method(Order, 'exists', (filter: any) => query(order && matches(order, filter) ? { _id: order._id } : null));
    mock.method(Order, 'find', (filter: any) => query(order && matches(order, filter) ? [order] : []));
    mock.method(Order, 'findOneAndUpdate', (filter: any, update: any, options: any) => {
        if (failSave) { failSave = false; throw new Error('Simulated database outage'); }
        if (!order && options?.upsert) { order = hydrateOrder({ _id: filter._id, ...update.$setOnInsert }); writes++; return query(order); }
        if (!order || !matches(order, filter)) return query(null);
        if (update.$set) { patch(order, update.$set); writes++; }
        return query(order);
    });
    mock.method(Restaurant, 'exists', (filter: any) => query(String(filter.owner) === String(owner) ? { _id: restaurant } : null));
    mock.method(Restaurant, 'findOne', (filter: any) => query(String(filter.owner) === String(owner) ? { _id: restaurant } : null));
    mock.method(Restaurant, 'findById', () => query({ _id: restaurant, owner, isOpen: true }));
    mock.method(User, 'exists', (filter: any) => query([String(owner), String(rider)].includes(String(filter._id)) ? { _id: filter._id } : null));
    mock.method(MenuItem, 'findById', (id: any) => query(String(id) === String(menu) ? { _id: menu, restaurant, name: 'Rice', price: 500, available: true } : null));
    mock.method(Profile, 'findOneAndUpdate', () => { if (!available) return query(null); available = false; return query({ user: rider }); });
    mock.method(Profile, 'updateOne', (_filter: any, update: any) => { available = update.$set.isAvailable; return query({}); });
    mock.method(Assignment, 'create', (values: any[]) => { assignment = { _id: new mongoose.Types.ObjectId(), status: 'assigned', ...values[0], async save() { writes++; return this; } }; return Promise.resolve([assignment]); });
    mock.method(Assignment, 'findOne', (filter: any) => query(assignment && matches(assignment, filter) ? assignment : null));
    mock.method(Assignment, 'find', (filter: any) => query(assignment && matches(assignment, filter) ? [{ ...assignment, order }] : []));
    mock.method(Attempt, 'findById', () => query(attempt));
    mock.method(Attempt, 'findOne', (filter: any) => query(attempt && matches(attempt, filter) ? attempt : null));
    mock.method(Attempt, 'findOneAndUpdate', (filter: any, update: any) => { attempt ??= { _id: filter._id, ...update.$setOnInsert, createdAt: new Date() }; return query(attempt); });
    mock.method(Attempt, 'updateOne', (_filter: any, update: any) => { Object.assign(attempt, update.$set); return query({}); });
    mock.method(payments, 'createPaymentIntent', async (input: any) => { intent.metadata = { orderId: input.orderId, customerId: input.customerId }; return { id: intent.id, status: intent.status, clientSecret: intent.client_secret }; });
    mock.method(payments, 'getPaymentIntent', async () => intent);
});
afterEach(() => mock.restoreAll());

async function call(handler: any, role: R, id: any, body = {}, params: any = {}) {
    let error: any; let result: any;
    const req = { user: { id: String(id), role }, params: { id: String(order?._id ?? ''), ...params }, body, query: {} } as Request;
    const res = { status() { return this; }, json(value: any) { result = value.data; } } as unknown as Response;
    await handler(req, res, ((value: any) => { error = value; }) as NextFunction);
    if (error) throw error;
    return result;
}

test('one paid order traverses owner → assigned rider → delivered, with timestamps and exactly one settlement', async () => {
    const id = String(order._id);
    for (const status of [S.CONFIRMED, S.PREPARING, S.READY_FOR_PICKUP]) {
        await call(updateOrderStatus, R.RESTAURANT_OWNER, owner, { status });
        assert.ok(order[timestampFor[status]!]); assert.equal(order.settlement.riderStatus, 'pending');
    }
    await call(assignRider, R.RESTAURANT_OWNER, owner, { riderId: String(rider), payout: 999999 }, { orderId: id });
    assert.equal(order.status, S.RIDER_ASSIGNED); assert.equal(assignment.payout, 350); assert.equal(available, false);
    assert.equal((await call(getMyDeliveries, R.DELIVERY_RIDER, rider))[0].order._id, order._id);
    for (const status of [S.PICKED_UP, S.OUT_FOR_DELIVERY, S.DELIVERED]) {
        await call(updateMyDeliveryStatus, R.DELIVERY_RIDER, rider, { status }, { id: String(assignment._id) });
        assert.equal(order.status, status); assert.ok(order[timestampFor[status]!]);
        assert.equal(String(order._id), id);
    }
    assert.equal(order.settlement.restaurantAmount, 1000); assert.equal(order.settlement.riderAmount, 350);
    assert.equal(order.settlement.restaurantStatus, 'available'); assert.equal(available, true);
    const written = writes; const date = order.deliveredAt;
    await call(updateMyDeliveryStatus, R.DELIVERY_RIDER, rider, { status: S.DELIVERED }, { id: String(assignment._id) });
    assert.equal(writes, written); assert.equal(order.deliveredAt, date);
    assert.equal((await call(getMyEarnings, R.DELIVERY_RIDER, rider)).totalEarnings, 350);
    await call(reviewDelivery, R.CUSTOMER, customer, { riderRating: 5, serviceRating: 4 });
    await assert.rejects(call(reviewDelivery, R.CUSTOMER, customer, { riderRating: 5, serviceRating: 4 }));
});

test('paid checkout survives order-save failure and retries without another charge or order', async () => {
    order = null;
    const input = { checkoutKey: 'checkout-test-stable-key', restaurant: String(restaurant), items: [{ menuItem: String(menu), quantity: 2, price: 1 }], deliveryAddress: 'Demo address', customer: String(stranger) };
    const first = await call(startCheckout, R.CUSTOMER, customer, input);
    assert.equal(first.quote.totalAmount, 1350); assert.equal(order, null);
    const resumed = await call(startCheckout, R.CUSTOMER, customer, { checkoutKey: input.checkoutKey });
    assert.equal(resumed.paymentIntentId, first.paymentIntentId);
    failSave = true;
    await assert.rejects(call(completeCheckout, R.CUSTOMER, customer, {}, { id: first.checkoutId }), /database outage/);
    assert.equal(order, null);
    const saved = await call(completeCheckout, R.CUSTOMER, customer, {}, { id: first.checkoutId });
    const repeated = await call(completeCheckout, R.CUSTOMER, customer, {}, { id: first.checkoutId });
    assert.equal(String(saved._id), first.checkoutId); assert.equal(saved, repeated); assert.equal(writes, 1);
    assert.equal(String(saved.customer), String(customer)); assert.equal(saved.paymentStatus, 'paid');
});

test('reject unpaid, wrong-amount, live-mode and wrong-customer checkout completion', async () => {
    order = null;
    const checkout = await call(startCheckout, R.CUSTOMER, customer, { checkoutKey: 'secure-checkout-key', restaurant: String(restaurant), items: [{ menuItem: String(menu), quantity: 2 }], deliveryAddress: 'Demo address' });
    for (const override of [{ livemode: true }, { amount_received: 1 }, { currency: 'usd' }, { status: 'processing' }]) {
        const original = { ...intent }; Object.assign(intent, override);
        await assert.rejects(call(completeCheckout, R.CUSTOMER, customer, {}, { id: checkout.checkoutId }));
        intent = original; assert.equal(order, null);
    }
    await assert.rejects(call(completeCheckout, R.CUSTOMER, stranger, {}, { id: checkout.checkoutId }));
});

test('wrong owner/customer cannot read or mutate order; owner cannot deliver', async () => {
    await assert.rejects(call(getOrderById, R.RESTAURANT_OWNER, stranger));
    await assert.rejects(call(getOrderById, R.CUSTOMER, stranger));
    await assert.rejects(call(updateOrderStatus, R.RESTAURANT_OWNER, stranger, { status: S.CONFIRMED }));
    await assert.rejects(call(updateOrderStatus, R.RESTAURANT_OWNER, owner, { status: S.DELIVERED }));
    await assert.rejects(call(cancelOrder, R.CUSTOMER, stranger));
    assert.equal(order.status, S.PLACED);
});

test('unavailable rider, wrong owner assignment and wrong rider updates are rejected', async () => {
    order.status = S.READY_FOR_PICKUP;
    available = false;
    await assert.rejects(call(assignRider, R.RESTAURANT_OWNER, owner, { riderId: String(rider) }, { orderId: String(order._id) }));
    assert.equal(assignment, null);
    available = true;
    await assert.rejects(call(assignRider, R.RESTAURANT_OWNER, stranger, { riderId: String(rider) }, { orderId: String(order._id) }));
    await call(assignRider, R.RESTAURANT_OWNER, owner, { riderId: String(rider) }, { orderId: String(order._id) });
    await assert.rejects(call(updateMyDeliveryStatus, R.DELIVERY_RIDER, stranger, { status: S.PICKED_UP }, { id: String(assignment._id) }));
    await assert.rejects(call(updateMyDeliveryStatus, R.DELIVERY_RIDER, rider, { status: S.PREPARING }, { id: String(assignment._id) }));
    assert.equal(order.status, S.RIDER_ASSIGNED);
});

test('cancellation is terminal and reviews require delivery, ownership and integer stars', async () => {
    await assert.rejects(call(reviewDelivery, R.CUSTOMER, customer, { riderRating: 5, serviceRating: 5 }));
    await call(cancelOrder, R.CUSTOMER, customer);
    assert.equal(order.settlement.riderStatus, 'cancelled');
    await assert.rejects(call(updateOrderStatus, R.RESTAURANT_OWNER, owner, { status: S.CONFIRMED }));
    await assert.rejects(call(assignRider, R.RESTAURANT_OWNER, owner, { riderId: String(rider) }, { orderId: String(order._id) }));
    await assert.rejects(call(reviewDelivery, R.CUSTOMER, customer, { riderRating: 1.5, serviceRating: 8 }));
});

test('server quote rejects fake IDs, mixed restaurants and invalid quantities', async () => {
    const base = { restaurant: String(restaurant), deliveryAddress: 'Demo address' };
    await assert.rejects(quoteOrder({ ...base, items: [{ menuItem: 'fake-catalogue-id', quantity: 1 }] }));
    await assert.rejects(quoteOrder({ ...base, items: [{ menuItem: String(menu), quantity: -1 }] }));
    await assert.rejects(quoteOrder({ ...base, restaurant: String(stranger), items: [{ menuItem: String(menu), quantity: 1 }] }));
});

test('legacy accepted remains supported; forbidden skips and role transitions fail', () => {
    assert.doesNotThrow(() => assertTransition(S.ACCEPTED, S.CONFIRMED, R.RESTAURANT_OWNER));
    for (const role of [R.CUSTOMER, R.RESTAURANT_OWNER, R.ADMIN]) {
        assert.throws(() => assertTransition(S.OUT_FOR_DELIVERY, S.DELIVERED, role));
    }
    assert.throws(() => assertTransition(S.RIDER_ASSIGNED, S.DELIVERED, R.DELIVERY_RIDER));
    assert.throws(() => assertTransition(S.PREPARING, S.CANCELLED, R.CUSTOMER));
});
