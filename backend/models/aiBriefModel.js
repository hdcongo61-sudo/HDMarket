import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, result: mongoose.Schema.Types.Mixed, expiresAt: Date }, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.AiBrief || mongoose.model('AiBrief', schema);
