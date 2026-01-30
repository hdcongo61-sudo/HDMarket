import mongoose from 'mongoose';

const improvementFeedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, trim: true, required: true, maxlength: 150 },
    body: { type: String, trim: true, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

improvementFeedbackSchema.index({ createdAt: -1 });

export default mongoose.model('ImprovementFeedback', improvementFeedbackSchema);
