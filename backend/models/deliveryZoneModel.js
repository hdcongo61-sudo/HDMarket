import mongoose from 'mongoose';

// Admin-defined delivery zones (e.g. "Zone A", "Zone B"...) that group
// communes together for the parcel pricing engine's zone-to-zone price
// matrix (see deliveryZonePriceModel.js). Independent of marketplace order
// delivery — see communeModel.js's deliveryPolicy for that.
const deliveryZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    color: { type: String, trim: true, default: '#e85d00' },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

deliveryZoneSchema.index({ isActive: 1, order: 1, name: 1 });

export default mongoose.model('DeliveryZone', deliveryZoneSchema);
