import mongoose from 'mongoose';

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

const deliveryLocationSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', default: null },
    cityName: { type: String, trim: true, default: '' },
    communeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commune', default: null },
    communeName: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    coordinates: { type: geoPointSchema, default: null }
  },
  { _id: false }
);

const productSnapshotSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    title: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    qty: { type: Number, min: 1, default: 1 }
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

const mapAccessSchema = new mongoose.Schema(
  {
    sellerVisibleUntil: { type: Date, default: null },
    buyerVisibleUntil: { type: Date, default: null },
    lockedAfterDistanceMeters: { type: Number, min: 0, default: 0 },
    lockedAfterStatus: {
      type: String,
      enum: ['IN_TRANSIT', 'DELIVERED'],
      default: 'DELIVERED'
    },
    sellerLockedAt: { type: Date, default: null },
    buyerLockedAt: { type: Date, default: null },
    lastAgentPingAt: { type: Date, default: null },
    lastAgentDistanceToPickupM: { type: Number, min: 0, default: null },
    lastAgentDistanceToDropoffM: { type: Number, min: 0, default: null }
  },
  { _id: false }
);

const deliveryRequestSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pickup: { type: deliveryLocationSchema, default: () => ({}) },
    dropoff: { type: deliveryLocationSchema, default: () => ({}) },
    deliveryPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: 'XAF' },
    deliveryPriceSource: {
      type: String,
      enum: ['SHOP_FREE', 'ADMIN_RULE', 'SELLER', 'BUYER', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    productSnapshot: { type: [productSnapshotSchema], default: [] },
    invoiceUrl: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    pickupInstructions: { type: String, trim: true, default: '' },
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
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    timeline: { type: [timelineEventSchema], default: [] },
    mapAccess: { type: mapAccessSchema, default: () => ({}) },
    // Legacy compatibility: productSnapshot remains source of truth for existing UI.
    itemsSnapshot: { type: [productSnapshotSchema], default: [] },
    pickupProof: { type: proofArtifactSchema, default: () => ({}) },
    deliveryProof: { type: proofArtifactSchema, default: () => ({}) },
    deliveryPinCodeHash: { type: String, trim: true, default: '' },
    deliveryPinCodeEncrypted: { type: String, trim: true, default: '' },
    deliveryPinCodeExpiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

deliveryRequestSchema.index({ status: 1, createdAt: -1 });
deliveryRequestSchema.index({ 'pickup.communeId': 1, status: 1, createdAt: -1 });
deliveryRequestSchema.index({ 'dropoff.communeId': 1, status: 1, createdAt: -1 });
deliveryRequestSchema.index({ 'pickup.cityId': 1, 'dropoff.cityId': 1, createdAt: -1 });

deliveryRequestSchema.pre('validate', function syncSnapshots(next) {
  const normalizeItems = (items = []) =>
    (Array.isArray(items) ? items : []).map((entry) => {
      const raw = entry?.toObject ? entry.toObject() : entry || {};
      const title = String(raw.title || raw.name || '').trim();
      return {
        ...raw,
        title,
        name: title
      };
    });

  const productSnapshot = normalizeItems(this.productSnapshot);
  const itemsSnapshot = normalizeItems(this.itemsSnapshot);
  if (!itemsSnapshot.length && productSnapshot.length) {
    this.itemsSnapshot = productSnapshot;
  }
  if (!productSnapshot.length && itemsSnapshot.length) {
    this.productSnapshot = itemsSnapshot;
  }
  if (productSnapshot.length && itemsSnapshot.length) {
    this.productSnapshot = productSnapshot;
    this.itemsSnapshot = itemsSnapshot;
  }
  next();
});

export default mongoose.model('DeliveryRequest', deliveryRequestSchema);
