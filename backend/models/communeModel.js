import mongoose from 'mongoose';

const communeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    levelType: { type: String, trim: true, default: 'DISTRICT' },
    isActive: { type: Boolean, default: true, index: true },
    deliveryPolicy: {
      type: String,
      enum: ['FREE', 'FIXED_FEE', 'DEFAULT_RULE'],
      default: 'DEFAULT_RULE',
      index: true
    },
    fixedFee: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0, min: 0 },
    // Commune Center — fallback GPS anchor for the parcel pricing engine when
    // a request only gives city/commune/address text, no GPS or landmark.
    latitude: { type: Number, default: null, min: -90, max: 90 },
    longitude: { type: Number, default: null, min: -180, max: 180 },
    // Which delivery zone this commune belongs to, for the parcel pricing
    // engine's zone-to-zone price matrix (separate from deliveryPolicy above,
    // which only governs marketplace order delivery fees).
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

communeSchema.index({ cityId: 1, name: 1 }, { unique: true });
communeSchema.index({ countryId: 1, cityId: 1, isActive: 1, order: 1 });
communeSchema.index({ cityId: 1, isActive: 1, order: 1, name: 1 });
communeSchema.index({ deliveryPolicy: 1, isActive: 1 });
communeSchema.index({ zoneId: 1 });

export default mongoose.model('Commune', communeSchema);
