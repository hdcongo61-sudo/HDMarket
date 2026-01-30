import mongoose from 'mongoose';

const searchHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query: { type: String, required: true, trim: true },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    pinnedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Compound index for efficient queries
searchHistorySchema.index({ user: 1, isPinned: -1, createdAt: -1 });
searchHistorySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('SearchHistory', searchHistorySchema);
