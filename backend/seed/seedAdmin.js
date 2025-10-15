import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';

dotenv.config();
await connectDB();

try {
  const email = 'admin@quickmarket.dev';
  const exists = await User.findOne({ email });
  if (!exists) {
    await User.create({ name: 'Admin', email, password: 'Admin@123', phone: '000000000', role: 'admin' });
    console.log('Admin created:', email);
  } else {
    console.log('Admin already exists');
  }
} catch (e) {
  console.error(e);
}

await mongoose.disconnect();
process.exit(0);
