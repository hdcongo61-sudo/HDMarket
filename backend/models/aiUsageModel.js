import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  actor: { type: String, required: true, index: true },
  feature: { type: String, required: true },
  model: String,
  state: { type: String, enum: ['reserved', 'completed', 'failed'], default: 'reserved' },
  inputTokens: { type: Number, default: 0 }, outputTokens: { type: Number, default: 0 },
  estimatedUsd: { type: Number, default: null },
  reservationXaf: { type: Number, required: true },
  // No prompts, conversation text, customer data or API secrets in this ledger.
}, { timestamps: true });
schema.index({ createdAt: -1, feature: 1 });
export default mongoose.models.AiUsage || mongoose.model('AiUsage', schema);
