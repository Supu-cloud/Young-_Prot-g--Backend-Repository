import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import { validateEnv } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';
import router from './routes/index';

dotenv.config();
validateEnv();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: '🚀 Food Ordering API is running' });
});

app.use('/api', router);
app.use(errorMiddleware);

connectDB().then(() => {
  app.listen(Number(process.env.PORT) || 5000, () => {
    logger.success(`Server running on port ${process.env.PORT || 5000}`);
    logger.info('Health check ➜ http://localhost:5000/health');
    logger.info('API Base    ➜ http://localhost:5000/api');
  });
});