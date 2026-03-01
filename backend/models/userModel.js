import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { WEEK_DAY_ORDER } from '../utils/shopHours.js';
import { generateUniqueSlug } from '../utils/slugUtils.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    phoneVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ['user', 'admin', 'manager', 'founder', 'delivery_agent'],
      default: 'user'
    },
    permissions: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true, index: true },
    isLocked: { type: Boolean, default: false, index: true },
    lockReason: { type: String, default: '', trim: true },
    lockedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    passwordResetToken: { type: String, default: null, index: true },
    passwordResetExpires: { type: Date, default: null, index: true },
    sessionsInvalidatedAt: { type: Date, default: null, index: true },
    canReadFeedback: { type: Boolean, default: false },
    canVerifyPayments: { type: Boolean, default: false },
    canManageBoosts: { type: Boolean, default: false },
    canManageComplaints: { type: Boolean, default: false },
    canManageProducts: { type: Boolean, default: false },
    canManageDelivery: { type: Boolean, default: false },
    canManageChatTemplates: { type: Boolean, default: false },
    canManageHelpCenter: { type: Boolean, default: false },
    accountType: { type: String, enum: ['person', 'shop'], default: 'person' },
    accountTypeChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    accountTypeChangedAt: { type: Date, default: null },
    country: { type: String, default: 'République du Congo' },
    city: { type: String, default: 'Brazzaville', trim: true },
    commune: { type: String, default: '', trim: true },
    gender: { type: String, enum: ['homme', 'femme'], default: 'homme' },
    preferredLanguage: { type: String, default: 'fr', trim: true },
    preferredCurrency: { type: String, default: 'XAF', trim: true, uppercase: true },
    preferredCity: { type: String, default: '', trim: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    address: { type: String, trim: true, default: '' },
    /** Geolocation for simple user (person) - delivery address position [longitude, latitude] */
    location: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (value) =>
            value === undefined ||
            value === null ||
            (Array.isArray(value) && value.length === 2 && value.every((item) => Number.isFinite(item))),
          message: 'Les coordonnées doivent contenir [longitude, latitude].'
        }
      }
    },
    locationUpdatedAt: { type: Date, default: null },
    locationAccuracy: { type: Number, default: null },
    shopName: { type: String },
    shopAddress: { type: String },
    shopLogo: { type: String },
    shopBanner: { type: String },
    shopVerified: { type: Boolean, default: false },
    shopVerificationSnapshot: {
      verified: { type: Boolean, default: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedAt: { type: Date, default: null }
    },
    shopDescription: { type: String, trim: true, default: '' },
    shopLocation: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (value) =>
            value === undefined ||
            value === null ||
            (Array.isArray(value) && value.length === 2 && value.every((item) => Number.isFinite(item))),
          message: 'Les coordonnées doivent contenir [longitude, latitude].'
        }
      }
    },
    shopLocationVerified: { type: Boolean, default: false },
    shopLocationAccuracy: { type: Number, default: null },
    shopLocationUpdatedAt: { type: Date, default: null },
    shopLocationTrustScore: { type: Number, default: 0, min: 0, max: 100 },
    shopLocationNeedsReview: { type: Boolean, default: false },
    shopLocationReviewStatus: {
      type: String,
      enum: ['approved', 'pending_review', 'rejected'],
      default: 'approved'
    },
    shopLocationReviewFlags: { type: [String], default: [] },
    shopLocationHistory: {
      type: [
        {
          coordinates: {
            type: [Number],
            default: []
          },
          accuracy: { type: Number, default: null },
          updatedAt: { type: Date, default: Date.now },
          source: { type: String, trim: true, default: 'manual' },
          trustScore: { type: Number, default: null, min: 0, max: 100 }
        }
      ],
      default: []
    },
    shopHours: {
      type: [
        {
          day: { type: String, enum: WEEK_DAY_ORDER },
          open: { type: String, default: '' },
          close: { type: String, default: '' },
          closed: { type: Boolean, default: true }
        }
      ],
      default: []
    },
    shopVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shopVerifiedAt: { type: Date, default: null },
    freeDeliveryEnabled: { type: Boolean, default: false, index: true },
    freeDeliveryNote: { type: String, trim: true, default: '' },
    shopBoosted: { type: Boolean, default: false },
    shopBoostScore: { type: Number, default: 0 },
    shopBoostedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shopBoostedAt: { type: Date, default: null },
    shopBoostedByName: { type: String, default: null },
    shopBoostStartDate: { type: Date, default: null },
    shopBoostEndDate: { type: Date, default: null },
    followersCount: { type: Number, default: 0, min: 0 },
    followingShops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    notificationPreferences: {
      product_comment: { type: Boolean, default: true },
      reply: { type: Boolean, default: true },
      favorite: { type: Boolean, default: true },
      rating: { type: Boolean, default: true },
      product_approval: { type: Boolean, default: true },
      product_rejection: { type: Boolean, default: true },
      product_boosted: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      shop_review: { type: Boolean, default: true },
      shop_follow: { type: Boolean, default: true },
      payment_pending: { type: Boolean, default: true },
      order_created: { type: Boolean, default: true },
      order_received: { type: Boolean, default: true },
      order_reminder: { type: Boolean, default: true },
      order_delivering: { type: Boolean, default: true },
      order_delivered: { type: Boolean, default: true },
      delivery_request_created: { type: Boolean, default: true },
      delivery_request_accepted: { type: Boolean, default: true },
      delivery_request_rejected: { type: Boolean, default: true },
      delivery_request_assigned: { type: Boolean, default: true },
      delivery_request_in_progress: { type: Boolean, default: true },
      delivery_request_delivered: { type: Boolean, default: true },
      order_cancelled: { type: Boolean, default: true },
      installment_due_reminder: { type: Boolean, default: true },
      installment_overdue_warning: { type: Boolean, default: true },
      installment_payment_submitted: { type: Boolean, default: true },
      installment_payment_validated: { type: Boolean, default: true },
      installment_sale_confirmation_required: { type: Boolean, default: true },
      installment_sale_confirmed: { type: Boolean, default: true },
      installment_completed: { type: Boolean, default: true },
      installment_product_suspended: { type: Boolean, default: true },
      review_reminder: { type: Boolean, default: true },
      order_address_updated: { type: Boolean, default: true },
      order_message: { type: Boolean, default: true },
      feedback_read: { type: Boolean, default: true },
      dispute_created: { type: Boolean, default: true },
      dispute_seller_responded: { type: Boolean, default: true },
      dispute_deadline_near: { type: Boolean, default: true },
      dispute_under_review: { type: Boolean, default: true },
      dispute_resolved: { type: Boolean, default: true },
      complaint_created: { type: Boolean, default: true },
      improvement_feedback_created: { type: Boolean, default: true },
      admin_broadcast: { type: Boolean, default: true },
      account_restriction: { type: Boolean, default: true },
      account_restriction_lifted: { type: Boolean, default: true },
      shop_conversion_approved: { type: Boolean, default: true },
      shop_conversion_rejected: { type: Boolean, default: true }
    },
    notificationsReadAt: { type: Date },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedReason: { type: String },
    restrictions: {
      canComment: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      },
      canOrder: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      },
      canMessage: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      },
      canAddFavorites: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      },
      canUploadImages: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      },
      canBeViewed: {
        restricted: { type: Boolean, default: false },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null },
        reason: { type: String, default: '' },
        restrictedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restrictedAt: { type: Date, default: null }
      }
    },
    reputationScore: { type: Number, default: 50, min: 0, max: 100 },
    disputeStats: {
      openedAsClient: { type: Number, default: 0, min: 0 },
      wonAsClient: { type: Number, default: 0, min: 0 },
      openedAgainstSeller: { type: Number, default: 0, min: 0 },
      lostAsSeller: { type: Number, default: 0, min: 0 },
      resolvedForSeller: { type: Number, default: 0, min: 0 }
    }
  },
  { timestamps: true }
);

userSchema.add({
  slug: { type: String, unique: true, index: true, lowercase: true, trim: true }
});
userSchema.index({ shopLocation: '2dsphere' }, { sparse: true });

userSchema.pre('validate', async function (next) {
  const needsSlug =
    !this.slug ||
    this.isModified('shopName') ||
    this.isModified('name') ||
    !this.shopName && this.isModified('name');
  if (!needsSlug) return next();
  try {
    const base = this.shopName || this.name || String(this._id);
    // eslint-disable-next-line no-await-in-loop
    this.slug = await generateUniqueSlug(this.constructor, base, this._id, 'slug');
  } catch (error) {
    return next(error);
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (this.isModified('role') && this.role === 'founder') {
    const existingFounder = await this.constructor.countDocuments({
      role: 'founder',
      _id: { $ne: this._id }
    });
    if (existingFounder > 0) {
      return next(new Error('Un seul compte fondateur est autorisé.'));
    }
  }
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);
