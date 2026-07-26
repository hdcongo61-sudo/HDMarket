import mongoose from 'mongoose';

const sellerMessageTemplateSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Short label shown on the template pill button (max ~30 chars)
    label: { type: String, required: true, trim: true, maxlength: 40 },
    // Full message text that gets inserted
    message: { type: String, required: true, trim: true, maxlength: 500 },
    // Sort order (lower = first)
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

sellerMessageTemplateSchema.index({ sellerId: 1, order: 1 });

export default mongoose.model('SellerMessageTemplate', sellerMessageTemplateSchema);
