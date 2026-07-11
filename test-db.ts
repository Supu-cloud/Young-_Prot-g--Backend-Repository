import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/food-ordering-db';

const testConnection = async (): Promise<void> => {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Database connection successful');
    console.log(`📍 Connected to: ${mongoose.connection.host}:${mongoose.connection.port}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Database connection failed');
    console.error(message);
  } finally {
    await mongoose.disconnect();
  }
};

testConnection();
