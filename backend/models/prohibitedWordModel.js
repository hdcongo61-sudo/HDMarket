import mongoose from 'mongoose';

const prohibitedWordSchema = new mongoose.Schema(
  {
    word: { type: String, required: true, unique: true, trim: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
  },
  { timestamps: true }
);

prohibitedWordSchema.index({ word: 1 });

export default mongoose.model('ProhibitedWord', prohibitedWordSchema);
