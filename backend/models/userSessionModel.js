import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, default: 'user', trim: true, index: true },
    connectedAt: { type: Date, required: true, default: Date.now, index: true },
    disconnectedAt: { type: Date, default: null, index: true },
    durationSeconds: { type: Number, default: 0, min: 0 },
    device: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'unknown'],
      default: 'unknown',
      index: true
    },
    ip: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true, index: true },
    namespace: { type: String, default: '/notifications', trim: true }
  },
  { timestamps: true }
);

userSessionSchema.index({ userId: 1, connectedAt: -1 });
userSessionSchema.index({ connectedAt: 1, role: 1 });
userSessionSchema.index({ connectedAt: 1, device: 1 });
userSessionSchema.index({ connectedAt: 1, city: 1 });

export default mongoose.model('UserSession', userSessionSchema);
