import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, maxlength: 100 },
  category: { type: String, enum: ['provider_ai', 'payment_fees', 'hosting', 'refund', 'other'], required: true },
  amount: { type: Number, min: 0.01, required: true }, currency: { type: String, required: true },
  note: { type: String, maxlength: 300 }, incurredAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
export default mongoose.models.PlatformExpense || mongoose.model('PlatformExpense', schema);
