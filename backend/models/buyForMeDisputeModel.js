import mongoose from 'mongoose';

const buyForMeDisputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, required: true, maxlength: 1000 },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'], default: 'OPEN', index: true },
    resolution: { type: String, trim: true, default: '', maxlength: 1000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true, collection: 'shopping_disputes' }
);

export default mongoose.models.BuyForMeDispute || mongoose.model('BuyForMeDispute', buyForMeDisputeSchema);
