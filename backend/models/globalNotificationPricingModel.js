import mongoose from 'mongoose';

const globalNotificationPricingSchema = new mongoose.Schema(
  {
    city: { type: String, trim: true, default: null },
    price: { type: Number, min: 0, required: true },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

globalNotificationPricingSchema.index({ city: 1 }, { unique: true });

globalNotificationPricingSchema.pre('validate', function normalizeCity(next) {
  if (typeof this.city === 'string') {
    const normalized = this.city.trim();
    this.city = normalized ? normalized : null;
  }
  next();
});

export default mongoose.model('GlobalNotificationPricing', globalNotificationPricingSchema);
