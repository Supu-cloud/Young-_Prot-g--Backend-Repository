import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mongoUri =
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/food-ordering-db';

const testConnection = async (): Promise<void> => {
    try {
        const connection = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });

        if (!connection.connection.db) {
            throw new Error('MongoDB did not provide a database connection');
        }

        await connection.connection.db.admin().ping();

        console.log('Database connection successful');
        console.log(`Host: ${connection.connection.host}`);
        console.log(`Database: ${connection.connection.name}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Database connection failed');
        console.error(`Reason: ${message}`);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

void testConnection();
