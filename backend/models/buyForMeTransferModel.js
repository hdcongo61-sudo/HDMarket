import mongoose from 'mongoose';

// One durable obligation per payment source / settlement, created in the same
// transaction as the shopping transition. Provider ids survive every retry.
const schema = new mongoose.Schema({
  operationKey: { type: String, required: true, unique: true },
  providerId: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true, index: true },
  type: { type: String, enum: ['REFUND', 'PAYOUT'], required: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  checkoutId: { type: String, default: '' },
  depositId: { type: String, default: '' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['READY', 'WAITING_REFERENCE', 'WAITING_ACCOUNT', 'PROCESSING', 'NEEDS_ATTENTION', 'COMPLETED', 'FAILED'], default: 'READY', index: true },
  recipient: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  failureReason: { type: String, default: '' },
  mismatch: { type: Boolean, default: false },
  attemptStartedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  lastCheckedAt: { type: Date, default: null },
  leaseUntil: { type: Date, default: null },
  leaseToken: { type: String, default: '' },
  attempts: { type: Number, default: 0 }
}, { timestamps: true, collection: 'shopping_transfers' });

export default mongoose.models.BuyForMeTransfer || mongoose.model('BuyForMeTransfer', schema);
