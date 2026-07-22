import mongoose from 'mongoose';

// Standalone "send a parcel" request (Lalamove/FlashEx-style errand delivery),
// deliberately NOT built on deliveryRequestModel.js: that model requires an
// Order + seller + buyer, which don't exist here — the requester just wants
// a courier to go collect something from a pickup point (a shop, an office,
// a friend's place) and bring it to a dropoff point. Field names for the
// assignment/stage/proof/GPS lifecycle intentionally mirror
// deliveryRequestModel.js so the same mental model (and several courier-side
// helpers) carries over, without coupling the two collections together.

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      default: undefined,
      validate: {
        validator: (value) =>
          value === undefined ||
          value === null ||
          (Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(Number(value[0])) &&
            Number.isFinite(Number(value[1]))),
        message: 'Coordinates must be [longitude, latitude].'
      }
    }
  },
  { _id: false }
);

const parcelLocationSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null },
    cityName: { type: String, trim: true, default: '' },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
    communeName: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    coordinates: { type: geoPointSchema, default: null },
    contactName: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const timelineEventSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const proofArtifactSchema = new mongoose.Schema(
  {
    photoUrl: { type: String, trim: true, default: '' },
    signatureUrl: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null }
  },
  { _id: false }
);

const parcelRequestSchema = new mongoose.Schema(
  {
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pickup: { type: parcelLocationSchema, default: () => ({}) },
    dropoff: { type: parcelLocationSchema, default: () => ({}) },
    parcelDescription: { type: String, trim: true, maxlength: 300, default: '' },
    // What the courier shows at the pickup point to prove they're authorized
    // to collect the parcel on the requester's behalf: a photo of the
    // invoice/receipt/ID, a reference code, and free-text notes.
    authorization: {
      proofImageUrl: { type: String, trim: true, default: '' },
      referenceCode: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, maxlength: 500, default: '' }
    },
    distanceMeters: { type: Number, min: 0, default: 0 },
    deliveryPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: 'XAF' },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED', 'IN_PROGRESS', 'DELIVERED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    currentStage: {
      type: String,
      enum: [
        'ASSIGNED',
        'ACCEPTED',
        'PICKUP_STARTED',
        'PICKED_UP',
        'IN_TRANSIT',
        'ARRIVED',
        'DELIVERED',
        'FAILED'
      ],
      default: 'ASSIGNED',
      index: true
    },
    assignmentStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    assignmentAcceptedAt: { type: Date, default: null },
    assignmentRejectedAt: { type: Date, default: null },
    assignmentRejectReason: { type: String, trim: true, default: '' },
    rejectionReason: { type: String, trim: true, default: '' },
    assignedDeliveryGuyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryGuy', default: null },
    expiresAt: { type: Date, default: null, index: true },
    timeline: { type: [timelineEventSchema], default: [] },
    currentLocation: { type: geoPointSchema, default: null },
    currentLocationUpdatedAt: { type: Date, default: null },
    pickupProof: { type: proofArtifactSchema, default: () => ({}) },
    deliveryProof: { type: proofArtifactSchema, default: () => ({}) },
    deliveryPinCodeHash: { type: String, trim: true, default: '' },
    deliveryPinCodeEncrypted: { type: String, trim: true, default: '' },
    deliveryPinCodeExpiresAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

parcelRequestSchema.index({ status: 1, createdAt: -1 });
parcelRequestSchema.index({ requesterId: 1, status: 1, createdAt: -1 });
parcelRequestSchema.index({ assignedDeliveryGuyId: 1, assignmentStatus: 1, updatedAt: -1 });
parcelRequestSchema.index({ currentLocation: '2dsphere' });

export default mongoose.model('ParcelRequest', parcelRequestSchema);
