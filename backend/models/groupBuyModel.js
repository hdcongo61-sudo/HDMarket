import mongoose from 'mongoose';

const groupBuyMemberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }
  },
  { _id: false }
);

const groupBuySchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupPrice: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, required: true, min: 0 },
    targetSize: { type: Number, required: true, min: 2 },
    deadline: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'filled', 'expired', 'cancelled'],
      default: 'open',
      index: true
    },
    members: { type: [groupBuyMemberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

groupBuySchema.index({ productId: 1, status: 1, createdAt: -1 });
groupBuySchema.index({ status: 1, deadline: 1 });

export default mongoose.model('GroupBuy', groupBuySchema);
