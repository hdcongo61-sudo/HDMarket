import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    lastStepId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatTemplate', default: null },
    completed: { type: Boolean, default: false },
    path: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatTemplate' }],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });
chatSessionSchema.index({ userId: 1, completed: 1, updatedAt: -1 });

export default mongoose.model('ChatSession', chatSessionSchema);
