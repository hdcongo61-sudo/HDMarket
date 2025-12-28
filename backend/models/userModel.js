import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },
    accountType: { type: String, enum: ['person', 'shop'], default: 'person' },
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
    shopVerified: { type: Boolean, default: false },
    shopDescription: { type: String, trim: true, default: '' },
    shopVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shopVerifiedAt: { type: Date, default: null },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    notificationPreferences: {
      product_comment: { type: Boolean, default: true },
      reply: { type: Boolean, default: true },
      favorite: { type: Boolean, default: true },
      rating: { type: Boolean, default: true },
      product_approval: { type: Boolean, default: true },
      product_rejection: { type: Boolean, default: true },
      promotional: { type: Boolean, default: true },
      shop_review: { type: Boolean, default: true },
      payment_pending: { type: Boolean, default: true },
      order_created: { type: Boolean, default: true },
      order_delivered: { type: Boolean, default: true }
    },
    notificationsReadAt: { type: Date },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedReason: { type: String }
  },
  { timestamps: true }
);

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
