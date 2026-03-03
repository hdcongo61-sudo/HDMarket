import mongoose from 'mongoose';

const deliveryGuySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    fullName: { type: String, trim: true, default: '' },
    // Legacy compatibility for existing records/UI
    name: { type: String, trim: true, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null, index: true },
    communes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commune' }],
    isActive: { type: Boolean, default: true, index: true },
    // Legacy compatibility for existing records/UI
    active: { type: Boolean, default: true },
    vehicleType: {
      type: String,
      enum: ['bike', 'motorcycle', 'car', 'van', 'truck', 'other', ''],
      default: ''
    },
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

deliveryGuySchema.index({ fullName: 1, name: 1 });
deliveryGuySchema.index({ cityId: 1, isActive: 1, updatedAt: -1 });
deliveryGuySchema.index({ communes: 1, isActive: 1, updatedAt: -1 });

deliveryGuySchema.pre('validate', function syncDeliveryGuyLegacyFields(next) {
  const resolvedName = String(this.fullName || this.name || '').trim();
  if (!resolvedName) {
    return next(new Error('Le nom complet du livreur est requis.'));
  }
  this.fullName = resolvedName;
  this.name = resolvedName;
  const resolvedActive =
    typeof this.isActive === 'boolean'
      ? this.isActive
      : typeof this.active === 'boolean'
      ? this.active
      : true;
  this.isActive = Boolean(resolvedActive);
  this.active = Boolean(resolvedActive);
  next();
});

export default mongoose.model('DeliveryGuy', deliveryGuySchema);
