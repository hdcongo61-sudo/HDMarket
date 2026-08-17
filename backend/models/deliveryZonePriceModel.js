import mongoose from 'mongoose';

// Base price for a courier trip from one zone to another (Zone A -> Zone A,
// Zone A -> Zone B, ...). This is the ZonePricingService's "Base Zone Price"
// contribution, used as the pricing engine's starting point when both
// pickup and dropoff resolve to a known commune/zone.
const deliveryZonePriceSchema = new mongoose.Schema(
  {
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
    fromZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', required: true, index: true },
    toZoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

deliveryZonePriceSchema.index({ countryId: 1, fromZoneId: 1, toZoneId: 1 }, { unique: true });

export default mongoose.model('DeliveryZonePrice', deliveryZonePriceSchema);
