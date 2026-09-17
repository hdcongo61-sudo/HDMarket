import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, calls: { type: Number, default: 0 }, reservedXaf: { type: Number, default: 0 }, expiresAt: Date });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.AiDailyBudget || mongoose.model('AiDailyBudget', schema);
