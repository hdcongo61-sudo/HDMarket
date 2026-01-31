import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';
import { normalizePhone } from '../utils/firebaseVerification.js';

dotenv.config();
await connectDB();

const toId = (value) => (value ? value.toString() : '');

try {
  const users = await User.find({})
    .select('_id phone email name')
    .lean();

  const normalizedMap = new Map();
  const conflicts = new Map();

  users.forEach((user) => {
    const normalized = normalizePhone(user.phone);
    if (!normalized) return;
    const existingId = normalizedMap.get(normalized);
    if (!existingId) {
      normalizedMap.set(normalized, toId(user._id));
    } else if (existingId !== toId(user._id)) {
      conflicts.set(normalized, new Set([existingId, toId(user._id)]));
    }
  });

  const conflictIds = new Set();
  conflicts.forEach((ids) => {
    ids.forEach((id) => conflictIds.add(id));
  });

  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  let conflictsCount = conflictIds.size;

  for (const user of users) {
    const normalized = normalizePhone(user.phone);
    if (!normalized) {
      invalid += 1;
      console.warn(`Invalid phone for ${user.email || user.name || user._id}: ${user.phone}`);
      continue;
    }
    if (normalized === user.phone) {
      skipped += 1;
      continue;
    }
    if (conflictIds.has(toId(user._id))) {
      console.warn(
        `Conflict for ${user.email || user.name || user._id}: ${user.phone} -> ${normalized}`
      );
      continue;
    }

    await User.updateOne({ _id: user._id }, { $set: { phone: normalized } });
    updated += 1;
  }

  console.log('Phone normalization summary:');
  console.log(`- Updated: ${updated}`);
  console.log(`- Skipped (already normalized): ${skipped}`);
  console.log(`- Invalid: ${invalid}`);
  console.log(`- Conflicts (manual review): ${conflictsCount}`);
} catch (error) {
  console.error('Normalization failed:', error);
} finally {
  await mongoose.disconnect();
  process.exit(0);
}
