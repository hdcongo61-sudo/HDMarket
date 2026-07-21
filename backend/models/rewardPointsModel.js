import mongoose from 'mongoose';

const pointsTransactionSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      enum: ['checkin', 'purchase', 'review', 'qa_answer', 'referral', 'redeem', 'admin_adjust'],
      required: true
    },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const rewardPointsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 },
    lifetimeEarned: { type: Number, default: 0, min: 0 },
    checkinStreak: { type: Number, default: 0, min: 0 },
    lastCheckinAt: { type: Date, default: null },
    transactions: { type: [pointsTransactionSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model('RewardPoints', rewardPointsSchema);
