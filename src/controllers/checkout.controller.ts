import { createHash } from 'crypto';
import { Types } from 'mongoose';
import CheckoutAttempt, {
    CheckoutQuote,
} from '../models/CheckoutAttempt.model';
import Order from '../models/Order.model';
import { quoteOrder } from '../services/order-quote.service';
import {
    createPaymentIntent,
    getPaymentIntent,
} from '../services/payment.service';
import { settlementFor } from '../services/order-lifecycle';
import { OrderStatus, PaymentStatus } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const startCheckout = asyncHandler(async (req, res) => {
    const key = req.body.checkoutKey;
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) {
        throw new ApiError(400, 'A stable checkout key is required');
    }
    const id = new Types.ObjectId(
        createHash('sha256')
            .update(`${req.user!.id}:${key}`)
            .digest('hex')
            .slice(0, 24)
    );
    let attempt = await CheckoutAttempt.findById(id);
    if (!attempt) {
        const quote = await quoteOrder(req.body);
        attempt = await CheckoutAttempt.findOneAndUpdate(
            { _id: id },
            { $setOnInsert: { customer: req.user!.id, quote } },
            { upsert: true, new: true }
        );
    }
    if (!attempt) {
        throw new ApiError(500, 'Unable to persist checkout');
    }
    const quote = attempt.quote as CheckoutQuote;
    // Stripe keys expire after 24h. Never create another intent when an old create
    // may have succeeded but its response was lost before the ID was stored.
    if (
        !attempt.paymentIntentId &&
        Date.now() - attempt.createdAt.getTime() > 23 * 60 * 60 * 1000
    ) {
        throw new ApiError(
            409,
            'This checkout needs payment recovery. Do not pay again; contact support with the checkout reference.'
        );
    }
    const payment = attempt.paymentIntentId
        ? await getPaymentIntent(attempt.paymentIntentId)
        : await createPaymentIntent({
              amount: Math.round(quote.totalAmount * 100),
              orderId: String(id),
              customerId: req.user!.id,
              idempotencyKey: `foodie-checkout-${id}`,
          });
    if (!attempt.paymentIntentId) {
        await CheckoutAttempt.updateOne(
            { _id: id },
            { $set: { paymentIntentId: payment.id } }
        );
    }
    const clientSecret =
        'clientSecret' in payment
            ? payment.clientSecret
            : payment.client_secret;
    res.json(
        ApiResponse.ok({
            checkoutId: String(id),
            paymentIntentId: payment.id,
            clientSecret,
            status: payment.status,
            quote,
        })
    );
});

export const completeCheckout = asyncHandler(async (req, res) => {
    const attempt = await CheckoutAttempt.findOne({
        _id: req.params.id,
        customer: req.user!.id,
    });
    if (!attempt?.paymentIntentId) {
        throw new ApiError(404, 'Payment checkout not found');
    }
    const quote = attempt.quote as CheckoutQuote;
    const intent = await getPaymentIntent(attempt.paymentIntentId);
    if (
        intent.livemode ||
        intent.status !== 'succeeded' ||
        intent.currency !== 'lkr' ||
        intent.amount_received !== Math.round(quote.totalAmount * 100) ||
        intent.metadata.orderId !== String(attempt._id) ||
        intent.metadata.customerId !== req.user!.id
    ) {
        throw new ApiError(
            409,
            'Test payment has not been verified for this checkout'
        );
    }
    // The checkout ID is also the eventual Order ID: concurrent retries cannot
    // create a second order, even if the response is lost after persistence.
    let order;
    try {
        order = await Order.findOneAndUpdate(
            { _id: attempt._id, customer: req.user!.id },
            {
                $setOnInsert: {
                    ...quote,
                    customer: req.user!.id,
                    paymentIntentId: intent.id,
                    paymentMethod: 'stripe_test',
                    paymentStatus: PaymentStatus.PAID,
                    status: OrderStatus.PLACED,
                    placedAt: new Date(),
                    settlement: settlementFor(
                        quote.subtotal,
                        quote.deliveryFee
                    ),
                },
            },
            { upsert: true, new: true, runValidators: true }
        );
    } catch (error) {
        if ((error as { code?: number }).code !== 11000) {
            throw error;
        }
        // A concurrent insert may win the unique _id race; return that same order.
        order = await Order.findOne({
            _id: attempt._id,
            customer: req.user!.id,
        });
        if (!order) {
            throw error;
        }
    }
    res.json(ApiResponse.ok(order, 'Paid order saved'));
});
