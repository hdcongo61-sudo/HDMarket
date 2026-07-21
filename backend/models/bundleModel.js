import mongoose from 'mongoose';

// A bundle is a fixed set of products (>=2) from the same seller that unlocks
// a discount when every product in the set is present in the buyer's cart at
// checkout. `source: 'auto'` bundles are synced from bundleService's
// "frequently bought together" suggestions so the discount shown on the PDP
// (BundleDeal.jsx) is the same one enforced server-side at order creation.
// `source: 'manual'` bundles let a seller curate their own set/discount.
const bundleSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    productIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Product',
      required: true
    },
    // Sorted, deduped, comma-joined productIds — lets us look up an exact
    // product set without relying on Mongo array-equality semantics.
    productIdsKey: { type: String, required: true, index: true },
    discountPercent: { type: Number, min: 0, max: 90, default: 5 },
    source: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

bundleSchema.index({ sellerId: 1, productIdsKey: 1, source: 1 }, { unique: true });
bundleSchema.index({ sellerId: 1, active: 1 });

bundleSchema.pre('validate', function normalizeBundle(next) {
  const sortedIds = Array.from(
    new Set((Array.isArray(this.productIds) ? this.productIds : []).map((id) => String(id)))
  ).sort();
  if (sortedIds.length < 2) {
    return next(new Error('Un lot doit contenir au moins 2 produits.'));
  }
  this.productIds = sortedIds;
  this.productIdsKey = sortedIds.join(',');
  next();
});

export default mongoose.model('Bundle', bundleSchema);
