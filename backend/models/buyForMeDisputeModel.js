import mongoose from 'mongoose';

const buyForMeDisputeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'BuyForMeOrder', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    reason: { type: String, trim: true, required: true, maxlength: 1000 },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'], default: 'OPEN', index: true },
    resolution: { type: String, trim: true, default: '', maxlength: 1000 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true, collection: 'shopping_disputes' }
);

export default mongoose.models.BuyForMeDispute || mongoose.model('BuyForMeDispute', buyForMeDisputeSchema);
