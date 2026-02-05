import mongoose from 'mongoose';

const prohibitedWordSchema = new mongoose.Schema(
  {
    word: { type: String, required: true, unique: true, trim: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
  },
  { timestamps: true }
);

// word already has unique: true (creates index); no need for duplicate schema.index

export default mongoose.model('ProhibitedWord', prohibitedWordSchema);
