import mongoose from 'mongoose';

const chatTemplateSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    response: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('ChatTemplate', chatTemplateSchema);
