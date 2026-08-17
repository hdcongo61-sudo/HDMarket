import mongoose from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    regionName: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0, min: 0 },
    deliveryAvailable: { type: Boolean, default: true },
    boostMultiplier: { type: Number, default: 1, min: 0 },
    // City Center — fallback GPS anchor for the parcel pricing engine when
    // neither GPS, a landmark, nor a commune center could be resolved.
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

citySchema.index({ countryId: 1, name: 1 }, { unique: true });
citySchema.index({ countryId: 1, isActive: 1, isDefault: -1, order: 1, name: 1 });

export default mongoose.model('City', citySchema);
