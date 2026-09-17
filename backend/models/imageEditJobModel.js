import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  operation: { type: String, required: true },
  prompt: { type: String, required: true, maxlength: 1000 },
  marketingTitle: { type: String, maxlength: 200 },
  marketingFacts: { type: String, maxlength: 2000 },
  marketingCopy: { headline: String, whatsapp: String, facebook: String },
  sourceUrl: { type: String, required: true },
  sourceAssetId: String,
  amount: { type: Number, required: true, min: 10 },
  currency: { type: String, default: 'XAF' },
  countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  checkoutId: { type: String, default: '' },
  state: { type: String, enum: ['AWAITING_PAYMENT', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'AWAITING_PAYMENT' },
  runToken: { type: String, default: '' },
  attempts: { type: Number, default: 0 },
  recoveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recoveredAt: Date,
  resultUrl: { type: String, default: '' },
  error: { type: String, default: '' }
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export default mongoose.models.ImageEditJob || mongoose.model('ImageEditJob', schema);
