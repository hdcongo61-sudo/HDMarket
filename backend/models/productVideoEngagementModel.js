import mongoose from 'mongoose';

const productVideoEngagementSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVideo', required: true, index: true },
    viewerKey: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    liked: { type: Boolean, default: false },
    saved: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0, min: 0 },
    watchTimeMs: { type: Number, default: 0, min: 0 },
    completedCount: { type: Number, default: 0, min: 0 },
    lastViewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

productVideoEngagementSchema.index({ video: 1, viewerKey: 1 }, { unique: true });
productVideoEngagementSchema.index({ user: 1, saved: 1, updatedAt: -1 });

export default mongoose.model('ProductVideoEngagement', productVideoEngagementSchema);
