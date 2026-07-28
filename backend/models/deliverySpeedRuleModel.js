import mongoose from 'mongoose';

// Standard / Express / Immediate — each a configurable extra price and an
// indicative ETA shown to the requester.
const deliverySpeedRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, uppercase: true, unique: true },
    label: { type: String, required: true, trim: true },
    extraPrice: { type: Number, default: 0, min: 0 },
    etaMinutes: { type: Number, default: 60, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

deliverySpeedRuleSchema.index({ isActive: 1, order: 1 });

export default mongoose.model('DeliverySpeedRule', deliverySpeedRuleSchema);
