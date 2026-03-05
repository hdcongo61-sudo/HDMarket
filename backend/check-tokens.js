import mongoose from 'mongoose';
import PushToken from './models/pushTokenModel.js';
import DeviceToken from './models/deviceTokenModel.js';
import User from './models/userModel.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkTokens() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({ role: { $in: ['founder', 'admin'] } }).select('_id email role name');
    console.log('--- Admins/Founders ---');
    console.log(users.map(u => `${u.email} (${u.role})`));

    for (const user of users) {
      console.log(`\nTokens for ${user.email}:`);
      const pushTokens = await PushToken.find({ user: user._id }).select('token platform isActive lastSeenAt -_id');
      console.log('PushTokens:', pushTokens);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}
checkTokens();
