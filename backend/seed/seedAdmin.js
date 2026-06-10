import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';
import { normalizePhone } from '../utils/firebaseVerification.js';

dotenv.config();
await connectDB();

const ADMIN_EMAIL = 'diallooumar.tech@gmail.com';

try {
  const exists = await User.findOne({ email: ADMIN_EMAIL });
  if (!exists) {
    const phone = normalizePhone('+242069822930');
    await User.create({ name: 'Oumar', email: ADMIN_EMAIL, password: 'Mo6368041.', phone, role: 'admin' });
    console.log('Admin created:', ADMIN_EMAIL);
  } else {
    // Ensure existing user has admin role
    if (exists.role !== 'admin') {
      exists.role = 'admin';
      await exists.save();
      console.log('Existing user promoted to admin:', ADMIN_EMAIL);
    } else {
      console.log('Admin already exists with correct role:', ADMIN_EMAIL);
    }
  }
} catch (e) {
  console.error(e);
}

await mongoose.disconnect();
process.exit(0);
