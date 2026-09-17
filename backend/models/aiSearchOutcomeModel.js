import mongoose from 'mongoose';
const schema = new mongoose.Schema({ resultCount: { type: Number, required: true }, countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' } }, { timestamps: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });
export default mongoose.models.AiSearchOutcome || mongoose.model('AiSearchOutcome', schema);
