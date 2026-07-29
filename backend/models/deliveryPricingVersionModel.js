import mongoose from 'mongoose';

const deliveryPricingVersionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true, unique: true, index: true },
    checksum: { type: String, required: true, trim: true, unique: true, index: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    source: {
      type: String,
      enum: ['AUTOMATIC', 'ADMIN_REFRESH', 'GENERATED_DEMO'],
      default: 'AUTOMATIC'
    },
    activatedAt: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

deliveryPricingVersionSchema.index({ activatedAt: -1 });

export default mongoose.model('DeliveryPricingVersion', deliveryPricingVersionSchema);
