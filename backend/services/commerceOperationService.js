import mongoose from 'mongoose';
import CommerceOperation from '../models/commerceOperationModel.js';

export const withCommerceOperation = async (key, work) => {
  try {
    await CommerceOperation.updateOne({ _id: key }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const operation = await CommerceOperation.findOneAndUpdate(
        { _id: key }, { $inc: { revision: 1 } }, { session, new: true }
      );
      result = await work(session, operation);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
