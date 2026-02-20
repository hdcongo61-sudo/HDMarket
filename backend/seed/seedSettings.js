import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { ensureDefaultSettingsBootstrap } from '../controllers/settingsController.js';

const run = async () => {
  try {
    await connectDB();
    await ensureDefaultSettingsBootstrap();
    // eslint-disable-next-line no-console
    console.log('Default settings seeded successfully.');
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to seed settings:', error);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
    } catch {
      // ignore
    }
  }
};

run();
