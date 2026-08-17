import mongoose from 'mongoose';

const GLOBAL_NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'REJECTED'];
const GLOBAL_NOTIFICATION_GENDERS = ['all', 'homme', 'femme'];

const globalNotificationImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    path: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const globalNotificationRequestSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    audienceScope: { type: String, enum: ['GLOBAL', 'COUNTRY', 'CITY'], default: 'COUNTRY' },
    currency: { type: String, trim: true, uppercase: true, default: 'XAF' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    title: { type: String, trim: true, required: true, maxlength: 120 },
    message: { type: String, trim: true, required: true, maxlength: 500 },
    image: { type: globalNotificationImageSchema, default: () => ({}) },
    audienceCity: { type: String, trim: true, default: null, index: true },
    audienceGender: { type: String, enum: GLOBAL_NOTIFICATION_GENDERS, default: 'all' },
    estimatedReach: { type: Number, default: 0, min: 0 },
    price: { type: Number, min: 0, required: true },
    paymentMethod: { type: String, enum: ['pawapay'], default: 'pawapay' },
    paymentStatus: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
    paymentTransactionId: { type: String, trim: true, default: '' },
    status: { type: String, enum: GLOBAL_NOTIFICATION_STATUSES, default: 'PENDING', index: true },
    rejectionReason: { type: String, trim: true, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    // The reach goal is the audience size matched at the moment admin confirmed the send —
    // stats are reported against this, not the (possibly stale) estimate shown at request time.
    matchedCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

globalNotificationRequestSchema.index({ status: 1, createdAt: -1 });
globalNotificationRequestSchema.index({ countryId: 1, status: 1, createdAt: -1 });
globalNotificationRequestSchema.index({ sellerId: 1, createdAt: -1 });
globalNotificationRequestSchema.index({ paymentTransactionId: 1 });

globalNotificationRequestSchema.pre('validate', function normalizeGlobalNotificationRequest(next) {
  if (typeof this.audienceCity === 'string') {
    const normalized = this.audienceCity.trim();
    this.audienceCity = normalized ? normalized : null;
  }
  next();
});

export { GLOBAL_NOTIFICATION_STATUSES, GLOBAL_NOTIFICATION_GENDERS };
export default mongoose.model('GlobalNotificationRequest', globalNotificationRequestSchema);
