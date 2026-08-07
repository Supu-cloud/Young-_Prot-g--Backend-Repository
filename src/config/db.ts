import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    const mongoUri =
        process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/food-ordering-db';

    try {
        const connection = await mongoose.connect(mongoUri);
        console.log(`MongoDB connected: ${connection.connection.host}`);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error connecting to MongoDB: ${message}`);
        console.error(
            'Make sure MongoDB is running locally or update MONGO_URI in your .env file.'
        );
        process.exit(1);
    }
};

export default connectDB;
