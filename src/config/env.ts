import dotenv from 'dotenv';
dotenv.config();

export const validateEnv = (): void => {
    const required = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = required.filter((k) => !process.env[k]);

    if (missing.length > 0) {
        console.error(`❌ Missing env variables: ${missing.join(', ')}`);
        process.exit(1);
    }
    console.log('✅ Environment variables OK!');
};

export const env = {
    MONGO_URI: process.env.MONGO_URI as string,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    PORT: process.env.PORT || '5000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
};
