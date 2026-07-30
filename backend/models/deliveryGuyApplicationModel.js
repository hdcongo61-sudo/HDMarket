import mongoose from 'mongoose';

const deliveryGuyApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    phoneRegisteredInOwnName: { type: Boolean, required: true },
    identityType: {
      type: String,
      enum: ['national_id', 'passport', 'driver_license'],
      default: 'national_id'
    },
    identityNumber: { type: String, required: true, trim: true, maxlength: 80 },
    identityFrontUrl: { type: String, required: true, trim: true },
    identityBackUrl: { type: String, required: true, trim: true },
    vehicleType: {
      type: String,
      enum: ['motorcycle', 'bike', 'car', 'van', 'other'],
      default: 'motorcycle'
    },
    vehicleBrand: { type: String, required: true, trim: true, maxlength: 80 },
    vehicleModel: { type: String, trim: true, maxlength: 80, default: '' },
    vehicleColor: { type: String, required: true, trim: true, maxlength: 50 },
    plateNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    vehiclePhotoUrl: { type: String, required: true, trim: true },
    platePhotoUrl: { type: String, required: true, trim: true },
    vehicleOwnership: {
      type: String,
      enum: ['self', 'family', 'borrowed', 'rented', 'employer', 'other'],
      default: 'self'
    },
    vehicleOwnerName: { type: String, trim: true, maxlength: 120, default: '' },
    vehicleOwnerPhone: { type: String, trim: true, maxlength: 30, default: '' },
    vehicleUseAuthorized: { type: Boolean, default: false },
    driverLicenseNumber: { type: String, trim: true, maxlength: 80, default: '' },
    driverLicensePhotoUrl: { type: String, trim: true, default: '' },
    serviceCityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null, index: true },
    serviceCommuneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null, index: true },
    serviceCity: { type: String, required: true, trim: true, maxlength: 100 },
    serviceCommune: { type: String, trim: true, maxlength: 100, default: '' },
    emergencyContactName: { type: String, required: true, trim: true, maxlength: 120 },
    emergencyContactPhone: { type: String, required: true, trim: true, maxlength: 30 },
    emergencyContactRelationship: { type: String, required: true, trim: true, maxlength: 80 },
    emergencyContactUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    applicantNote: { type: String, trim: true, maxlength: 1000, default: '' },
    buyForMeOptIn: { type: Boolean, default: false },
    declarationsAccepted: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
    deliveryGuy: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGuy', default: null }
  },
  { timestamps: true }
);

deliveryGuyApplicationSchema.index({ user: 1, createdAt: -1 });
deliveryGuyApplicationSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
deliveryGuyApplicationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('DeliveryGuyApplication', deliveryGuyApplicationSchema);
