import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'unknown'],
      default: 'unknown'
    },
    deviceId: { type: String, default: '', trim: true },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

pushTokenSchema.index({ user: 1, token: 1 });

export default mongoose.model('PushToken', pushTokenSchema);
