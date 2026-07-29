import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { seedGeneratedBrazzavillePricingData } from '../modules/delivery/seeds/generatedBrazzavillePricingData.js';

const run = async () => {
  try {
    await connectDB();
    const result = await seedGeneratedBrazzavillePricingData();
    console.warn('Generated delivery pricing data installed:', result);
    process.exitCode = 0;
  } catch (error) {
    console.error('Failed to install generated delivery pricing data:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
};

run();
