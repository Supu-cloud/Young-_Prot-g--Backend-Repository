"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('❌ MONGO_URI is not defined in environment variables');
        process.exit(1);
    }
    try {
        const conn = await mongoose_1.default.connect(mongoUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error connecting to MongoDB: ${message}`);
        process.exit(1);
    }
};
exports.default = connectDB;
