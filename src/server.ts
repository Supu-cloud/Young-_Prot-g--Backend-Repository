import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import connectDB from './config/db';
import { validateEnv } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import router from './routes';
import { logger } from './utils/logger';

dotenv.config();
validateEnv();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
