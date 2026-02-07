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
    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },
    canReadFeedback: { type: Boolean, default: false },
    canVerifyPayments: { type: Boolean, default: false },
    canManageBoosts: { type: Boolean, default: false },
    canManageComplaints: { type: Boolean, default: false },
    accountType: { type: String, enum: ['person', 'shop'], default: 'person' },
    accountTypeChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    accountTypeChangedAt: { type: Date, default: null },
    country: { type: String, default: 'République du Congo' },
    city: {
      type: String,
      enum: ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'],
      default: 'Brazzaville'
    },
    gender: { type: String, enum: ['homme', 'femme'], default: 'homme' },
    address: { type: String, trim: true, default: '' },
    shopName: { type: String },
    shopAddress: { type: String },
    shopLogo: { type: String },
    shopBanner: { type: String },
    shopVerified: { type: Boolean, default: false },
    shopDescription: { type: String, trim: true, default: '' },
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
      payment_pending: { type: Boolean, default: true },
      order_created: { type: Boolean, default: true },
      order_received: { type: Boolean, default: true },
      order_reminder: { type: Boolean, default: true },
      order_delivering: { type: Boolean, default: true },
      order_delivered: { type: Boolean, default: true },
      review_reminder: { type: Boolean, default: true },
      order_address_updated: { type: Boolean, default: true },
      order_message: { type: Boolean, default: true },
      feedback_read: { type: Boolean, default: true }
    },
    notificationsReadAt: { type: Date },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedReason: { type: String }
  },
  { timestamps: true }
);

userSchema.add({
  slug: { type: String, unique: true, index: true, lowercase: true, trim: true }
});

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
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);
