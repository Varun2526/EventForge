import mongoose from 'mongoose';
import { env } from './env.js';


export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Check replica set status for transaction readiness
    try {
      const admin = conn.connection.db.admin();
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log(`ℹ️ MongoDB Replica Set Active: "${status.set}" (ACID Transactions Ready)`);
    } catch {
      console.warn('⚠️ MongoDB is running as a standalone server. Multi-document transactions require a replica set in Phase 3.');
    }

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting reconnection...');
    });

    return conn;
  } catch (error) {
    console.error(`❌ Failed to connect to MongoDB at ${env.MONGODB_URI}:`, error.message);
    throw error;
  }
};


export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log('🛑 MongoDB connection closed cleanly.');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};
