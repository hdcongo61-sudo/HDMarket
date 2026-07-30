import mongoose from 'mongoose';

const buyForMeTransactionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: {
      type: String,
      enum: ['FUNDING', 'ADDITIONAL_FUNDING', 'DRIVER_EARNING', 'WALLET_REFUND', 'DRIVER_TIP', 'PLATFORM_DONATION'],
      required: true
    },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['PENDING', 'RESERVED', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    providerReference: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'shopping_transactions' }
);

buyForMeTransactionSchema.index({ orderId: 1, type: 1, createdAt: -1 });

export default mongoose.models.BuyForMeTransaction || mongoose.model('BuyForMeTransaction', buyForMeTransactionSchema);
