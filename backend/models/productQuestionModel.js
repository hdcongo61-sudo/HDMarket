import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isSeller: { type: Boolean, default: false },
    isVerifiedBuyer: { type: Boolean, default: false },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    upvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] }
  },
  { timestamps: true }
);

const productQuestionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    answers: { type: [answerSchema], default: [] },
    upvotes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    status: { type: String, enum: ['visible', 'hidden'], default: 'visible', index: true }
  },
  { timestamps: true }
);

productQuestionSchema.index({ productId: 1, status: 1, createdAt: -1 });
productQuestionSchema.index({ sellerId: 1, createdAt: -1 });

export default mongoose.model('ProductQuestion', productQuestionSchema);
