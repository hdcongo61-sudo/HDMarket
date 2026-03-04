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
    deviceInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    failureCount: {
      type: Number,
      default: 0
    },
    disabledReason: {
      type: String,
      default: '',
      trim: true
    },
    lastFailureAt: {
      type: Date,
      default: null
    },
    lastFailureCode: {
      type: String,
      default: ''
    },
    lastDeliveredAt: {
      type: Date,
      default: null
    },
    lastOpenedAt: {
      type: Date,
      default: null
    },
    lastSeenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

pushTokenSchema.index({ user: 1, token: 1 });
pushTokenSchema.index({ user: 1, isActive: 1, platform: 1 });

export default mongoose.model('PushToken', pushTokenSchema);
