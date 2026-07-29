import mongoose from 'mongoose';

const deliveryPricingEventSchema = new mongoose.Schema(
  {
    pricingVersion: { type: String, trim: true, default: '', index: true },
    durationMs: { type: Number, min: 0, default: 0 },
    cacheSource: {
      type: String,
      enum: ['memory', 'redis', 'database', 'unknown'],
      default: 'unknown',
      index: true
    },
    pickupCommuneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
    dropoffCommuneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
    distanceMeters: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0, default: 0 },
    packageTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'PackageType', default: null },
    deliverySpeed: { type: String, trim: true, uppercase: true, default: 'STANDARD' },
    resolvedPickupFrom: { type: String, trim: true, default: 'UNRESOLVED' },
    resolvedDropoffFrom: { type: String, trim: true, default: 'UNRESOLVED' },
    breakdown: {
      type: [
        {
          label: { type: String, trim: true, default: '' },
          amount: { type: Number, default: 0 }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

deliveryPricingEventSchema.index({ createdAt: -1 });
deliveryPricingEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
deliveryPricingEventSchema.index({ pickupCommuneId: 1, dropoffCommuneId: 1, createdAt: -1 });

export default mongoose.model('DeliveryPricingEvent', deliveryPricingEventSchema);
