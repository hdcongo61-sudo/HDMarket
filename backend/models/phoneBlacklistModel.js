import mongoose from 'mongoose';

const phoneBlacklistSchema = new mongoose.Schema(
  {
    phoneNormalized: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true
    },
    phoneVariants: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    source: {
      type: String,
      enum: ['founder_hard_delete', 'manual'],
      default: 'manual'
    },
    blockedEntityType: {
      type: String,
      enum: ['user', 'shop'],
      default: 'user'
    },
    blockedEntitySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    blockedAt: {
      type: Date,
      default: Date.now
    },
    unblockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    unblockedAt: {
      type: Date,
      default: null
    },
    unblockedReason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

phoneBlacklistSchema.index({ isActive: 1, blockedAt: -1 });
phoneBlacklistSchema.index({ blockedAt: -1 });

export default mongoose.model('PhoneBlacklist', phoneBlacklistSchema);
