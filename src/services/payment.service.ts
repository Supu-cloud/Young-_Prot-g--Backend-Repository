import Stripe from 'stripe';

import { ApiError } from '../utils/ApiError';

export interface CreatePaymentInput {
    amount: number;
    orderId: string;
    currency?: Stripe.PaymentIntentCreateParams['currency'];
    customerEmail?: string;
    customerId?: string;
    idempotencyKey?: string;
}

export interface PaymentIntentResult {
    id: string;
    clientSecret: string;
    status: Stripe.PaymentIntent.Status;
}

let stripe: Stripe | undefined;

const getStripe = (): Stripe => {
    if (stripe) {
        return stripe;
    }

    const secret = process.env.STRIPE_SECRET_KEY?.trim();

    if (!secret) {
        throw new ApiError(500, 'STRIPE_SECRET_KEY is not configured');
    }

    if (!/^(sk|rk)_test_/.test(secret)) {
        throw new ApiError(503, 'Foodie demo requires Stripe TEST MODE keys');
    }

    stripe = new Stripe(secret);
    return stripe;
};

const validateAmount = (amount: number): void => {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new ApiError(
            400,
            'Payment amount must be a positive integer in the smallest currency unit'
        );
    }
};

export const createPaymentIntent = async (
    input: CreatePaymentInput
): Promise<PaymentIntentResult> => {
    validateAmount(input.amount);

    if (!input.orderId.trim()) {
        throw new ApiError(400, 'Order ID is required');
    }

    const intent = await getStripe().paymentIntents.create(
        {
            amount: input.amount,
            currency: input.currency || 'lkr',
            receipt_email: input.customerEmail,
            metadata: {
                orderId: input.orderId,
                customerId: input.customerId || '',
            },
            automatic_payment_methods: {
                enabled: true,
            },
        },
        {
            idempotencyKey:
                input.idempotencyKey || `foodie-order-${input.orderId}`,
        }
    );

    if (!intent.client_secret) {
        throw new Error('Stripe did not return a payment client secret');
    }

    return {
        id: intent.id,
        clientSecret: intent.client_secret,
        status: intent.status,
    };
};

export const getPaymentIntent = async (
    paymentIntentId: string
): Promise<Stripe.PaymentIntent> => {
    if (!paymentIntentId.trim()) {
        throw new ApiError(400, 'Payment intent ID is required');
    }
    return getStripe().paymentIntents.retrieve(paymentIntentId);
};

export const refundPayment = async (
    paymentIntentId: string,
    amount?: number
): Promise<Stripe.Refund> => {
    if (!paymentIntentId.trim()) {
        throw new ApiError(400, 'Payment intent ID is required');
    }

    if (amount !== undefined) {
        validateAmount(amount);
    }

    return getStripe().refunds.create({
        payment_intent: paymentIntentId,
        amount,
    });
};

export const constructPaymentEvent = (
    payload: Buffer,
    signature: string
): Stripe.Event => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {
        throw new ApiError(500, 'STRIPE_WEBHOOK_SECRET is not configured');
    }

    return getStripe().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
    );
};
