import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';
import { normalizePhone } from '../utils/twilioVerify.js';

dotenv.config();
await connectDB();

try {
  const email = 'oumar@gmail.com';
  const exists = await User.findOne({ email });
  if (!exists) {
    const phone = normalizePhone('069822930');
    await User.create({ name: 'Oumar', email, password: 'Admin@123', phone, role: 'admin' });
    console.log('Admin created:', email);
  } else {
    console.log('Admin already exists');
  }
} catch (e) {
  console.error(e);
}

await mongoose.disconnect();
process.exit(0);
