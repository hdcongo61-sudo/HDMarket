import mongoose from 'mongoose';

const buyForMeRefundSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    destination: { type: String, enum: ['HDMARKET_WALLET'], default: 'HDMARKET_WALLET' },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    reference: { type: String, trim: true, default: '' }
  },
  { timestamps: true, collection: 'shopping_refunds' }
);

export default mongoose.models.BuyForMeRefund || mongoose.model('BuyForMeRefund', buyForMeRefundSchema);
