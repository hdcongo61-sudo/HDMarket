import mongoose from 'mongoose';

const communeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    deliveryPolicy: {
      type: String,
      enum: ['FREE', 'FIXED_FEE', 'DEFAULT_RULE'],
      default: 'DEFAULT_RULE',
      index: true
    },
    fixedFee: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

communeSchema.index({ cityId: 1, name: 1 }, { unique: true });
communeSchema.index({ cityId: 1, isActive: 1, order: 1, name: 1 });
communeSchema.index({ deliveryPolicy: 1, isActive: 1 });

export default mongoose.model('Commune', communeSchema);
