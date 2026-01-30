import mongoose from 'mongoose';

const accountTypeChangeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    previousType: { type: String, enum: ['person', 'shop'], required: true },
    newType: { type: String, enum: ['person', 'shop'], required: true },
    previousShopData: {
      shopName: { type: String, default: null },
      shopAddress: { type: String, default: null },
      shopLogo: { type: String, default: null },
      shopVerified: { type: Boolean, default: false }
    },
    newShopData: {
      shopName: { type: String, default: null },
      shopAddress: { type: String, default: null },
      shopLogo: { type: String, default: null }
    },
    reason: { type: String, trim: true, maxlength: 500, default: '' }
  },
  { timestamps: true }
);

accountTypeChangeSchema.index({ user: 1, createdAt: -1 });
accountTypeChangeSchema.index({ changedBy: 1, createdAt: -1 });

export default mongoose.model('AccountTypeChange', accountTypeChangeSchema);
