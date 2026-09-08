import dotenv from 'dotenv';
dotenv.config(); // dotenv.config() ඉහළින්ම පැවැතීම වැදගත්ය

import cors from 'cors';
import express from 'express';
import path from 'path';

import connectDB from './config/db';
import { validateEnv } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import router from './routes';
import { logger } from './utils/logger';

validateEnv();

const app = express();
const port = Number(process.env.PORT) || 5000;

// CORS Config (Port 5175 ඇතුළු ඕනෑම Frontend Port එකකට අවසර දීම)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve images from public folder
app.use('/images', express.static(path.join(process.cwd(), 'public')));

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
