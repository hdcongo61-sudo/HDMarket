import mongoose from 'mongoose';

const deliveryLogSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    ipAddress: { type: String, trim: true, default: '' },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null }
    },
    actionType: {
      type: String,
      enum: ['PROOF_UPLOADED', 'SIGNATURE_CAPTURED', 'CONFIRMED'],
      required: true
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

deliveryLogSchema.index({ orderId: 1, createdAt: -1 });

export default mongoose.model('DeliveryLog', deliveryLogSchema);
