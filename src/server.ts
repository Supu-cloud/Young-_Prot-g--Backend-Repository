import dotenv from 'dotenv';
dotenv.config(); // dotenv.config() ඉහළින්ම පැවැතීම වැදගත්ය

import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import Stripe from 'stripe';

import connectDB from './config/db';
import { validateEnv } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import router from './routes';
import { logger } from './utils/logger';

validateEnv();

const app = express();
const port = Number(process.env.PORT) || 5000;

// Stripe Key එක පරික්ෂා කිරීම
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

if (!stripeSecretKey) {
    console.error('❌ Error: STRIPE_SECRET_KEY is not defined in .env file!');
}

// Stripe Instance එක Initialize කිරීම
const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
});

// CORS Config (Port 5175 ඇතුළු ඕනෑම Frontend Port එකකට අවසර දීම)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve images from public folder
app.use('/images', express.static(path.join(process.cwd(), 'public')));

// Stripe Payment Intent Endpoint
app.post('/api/create-payment-intent', async (req: Request, res: Response) => {
    try {
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // LKR Cents බවට හැරවීම
            currency: 'lkr',
            payment_method_types: ['card'],
        });

        res.status(200).send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error
                ? error.message
                : 'Failed to create payment intent';

        res.status(500).json({ error: message });
    }
});

app.get('/health', (_req, res) => {
    res.json({ status: 'OK', message: 'Food Ordering API is running' });
});

app.use('/api', router);
app.use(errorMiddleware);

const startServer = async (): Promise<void> => {
    await connectDB();

    app.listen(port, () => {
        logger.success(`Server running on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`API base: http://localhost:${port}/api`);
    });
};

void startServer();
