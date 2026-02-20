import mongoose from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    deliveryAvailable: { type: Boolean, default: true },
    boostMultiplier: { type: Number, default: 1, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

citySchema.index({ isActive: 1, isDefault: -1, name: 1 });

export default mongoose.model('City', citySchema);
