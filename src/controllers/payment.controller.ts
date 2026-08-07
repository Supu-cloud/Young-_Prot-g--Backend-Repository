import { Request, Response } from 'express';
import Order from '../models/Order.model';
import { createPaymentIntent } from '../services/payment.service';
import { PaymentStatus } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const startPayment = asyncHandler(
    async (req: Request, res: Response) => {
        const order = await Order.findOne({
            _id: req.params.orderId,
            customer: req.user?.id,
        }).populate('customer', 'email');
        if (!order) throw new ApiError(404, 'Order not found');
        if (order.paymentStatus === PaymentStatus.PAID)
            throw new ApiError(409, 'Order is already paid');
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
