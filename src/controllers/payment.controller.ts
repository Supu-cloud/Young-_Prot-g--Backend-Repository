import { Request, Response } from 'express';
import Order from '../models/Order.model';
import {
    createPaymentIntent,
    getPaymentIntent,
} from '../services/payment.service';
import { PaymentStatus } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const startPayment = asyncHandler(
    async (req: Request, res: Response) => {
        const order = await Order.findOne({
            _id: req.params.orderId,
            customer: req.user?.id,
        })
            .select('+paymentIntentId')
            .populate('customer', 'email');
        if (!order) throw new ApiError(404, 'Order not found');
        if (['cancelled', 'declined', 'delivered'].includes(order.status)) {
            throw new ApiError(409, 'This order cannot accept a payment');
        }
        if (order.paymentStatus === PaymentStatus.PAID)
            throw new ApiError(409, 'Order is already paid');
        if (order.paymentIntentId) {
            const existing = await getPaymentIntent(order.paymentIntentId);
            if (existing.client_secret && existing.status !== 'canceled') {
                res.json(
                    ApiResponse.ok(
                        {
                            id: existing.id,
                            clientSecret: existing.client_secret,
                            status: existing.status,
                        },
                        'Existing payment resumed'
                    )
                );
                return;
            }
            throw new ApiError(
                409,
                'Payment was cancelled. Contact support before starting another payment.'
            );
        }
        const customer = order.customer as unknown as { email?: string };
        const payment = await createPaymentIntent({
            amount: Math.round(order.totalAmount * 100),
            orderId: order.id,
            customerEmail: customer.email,
        });
        order.paymentIntentId = payment.id;
        await order.save();
        res.status(201).json(ApiResponse.ok(payment, 'Payment initialized'));
    }
);

export const confirmPayment = asyncHandler(
    async (req: Request, res: Response) => {
        const order = await Order.findOne({
            _id: req.params.orderId,
            customer: req.user?.id,
        }).select('+paymentIntentId');
        if (!order) throw new ApiError(404, 'Order not found');
        if (order.paymentStatus === PaymentStatus.PAID) {
            res.json(ApiResponse.ok(order, 'Payment already confirmed'));
            return;
        }
        if (!order.paymentIntentId)
            throw new ApiError(
                409,
                'Payment has not been initialized for this order'
            );
        const requestedIntentId =
            typeof req.body.paymentIntentId === 'string'
                ? req.body.paymentIntentId.trim()
                : '';
        if (requestedIntentId && requestedIntentId !== order.paymentIntentId)
            throw new ApiError(409, 'Payment intent does not match this order');

        const intent = await getPaymentIntent(order.paymentIntentId);
        if (
            intent.livemode ||
            intent.currency !== 'lkr' ||
            intent.amount_received !== Math.round(order.totalAmount * 100)
        ) {
            throw new ApiError(
                409,
                'Payment currency, test mode or amount does not match the order'
            );
        }
        if (intent.metadata.orderId !== order.id)
            throw new ApiError(409, 'Payment does not belong to this order');
        if (intent.status !== 'succeeded')
            throw new ApiError(409, `Payment is ${intent.status}`);

        order.paymentStatus = PaymentStatus.PAID;
        await order.save();
        res.json(ApiResponse.ok(order, 'Payment confirmed'));
    }
);
