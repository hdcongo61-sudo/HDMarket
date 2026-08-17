import mongoose from 'mongoose';

const deliveryGuySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    managerScope: { type: String, enum: ['COUNTRY_MANAGER', 'CITY_MANAGER', 'AGENT'], default: 'AGENT' },
    cityIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }], default: [] },
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
    vehicleBrand: { type: String, trim: true, default: '' },
    vehicleModel: { type: String, trim: true, default: '' },
    vehicleColor: { type: String, trim: true, default: '' },
    plateNumber: { type: String, trim: true, uppercase: true, default: '', index: true },
    vehiclePhotoUrl: { type: String, trim: true, default: '' },
    platePhotoUrl: { type: String, trim: true, default: '' },
    vehicleOwnership: {
      type: String,
      enum: ['self', 'family', 'borrowed', 'rented', 'employer', 'other', ''],
      default: ''
    },
    vehicleOwnerName: { type: String, trim: true, default: '' },
    vehicleOwnerPhone: { type: String, trim: true, default: '' },
    phoneRegisteredInOwnName: { type: Boolean, default: false },
    buyForMeOptIn: { type: Boolean, default: false, index: true },
    emergencyContactUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emergencyContactName: { type: String, trim: true, default: '' },
    emergencyContactPhone: { type: String, trim: true, default: '' },
    emergencyContactRelationship: { type: String, trim: true, default: '' },
    identityVerifiedAt: { type: Date, default: null },
    driverLicenseVerifiedAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

deliveryGuySchema.index({ fullName: 1, name: 1 });
deliveryGuySchema.index({ cityId: 1, isActive: 1, updatedAt: -1 });
deliveryGuySchema.index({ countryId: 1, isActive: 1, updatedAt: -1 });
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
