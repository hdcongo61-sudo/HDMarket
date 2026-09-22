import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  refundId: { type: String, required: true, unique: true },
  operationKey: { type: String, required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dispute: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute', default: null },
  source: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  checkoutIds: { type: [String], default: [] },
  status: { type: String, enum: ['CREATED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'CREATED', index: true },
  failureReason: { type: String, default: '' },
  completedAt: { type: Date, default: null },
  effectsPending: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.InstallmentRefundBatch || mongoose.model('InstallmentRefundBatch', schema);
