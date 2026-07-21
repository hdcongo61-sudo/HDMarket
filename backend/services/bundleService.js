/**
 * Bundle Service — "Frequently Bought Together" suggestions
 * Proposal 7 of HDMarket Taobao-Inspired Improvements
 *
 * Algorithm:
 *  1. Find orders containing this product from the same seller
 *  2. Count co-occurring products
 *  3. Return top 2-4 products with bundle discount
 */

import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Bundle from '../models/bundleModel.js';

const BUNDLE_DISCOUNT_PCT = 5; // 5% off when buying as bundle

const buildProductIdsKey = (productIds = []) =>
  Array.from(new Set((productIds || []).map((id) => String(id)))).sort().join(',');

/**
 * Persists the suggestion shown on the PDP as an 'auto' Bundle so the same
 * discount can be enforced at checkout if the buyer adds the full set to
 * cart. Best-effort: suggestions still render even if this write fails.
 */
const syncAutoBundle = async ({ sellerId, productIds, discountPercent }) => {
  if (!sellerId || !Array.isArray(productIds) || productIds.length < 2) return;
  const productIdsKey = buildProductIdsKey(productIds);
  try {
    await Bundle.findOneAndUpdate(
      { sellerId, productIdsKey, source: 'auto' },
      {
        $set: {
          sellerId,
          productIds: productIdsKey.split(','),
          productIdsKey,
          discountPercent,
          source: 'auto',
          active: true
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch {
    // Race on concurrent upsert or transient DB error — safe to ignore.
  }
};

/**
 * Loads every active bundle (auto + manual) for the given sellers and
 * applies matching discounts in-place to order items whose full product set
 * is present in the cart for that seller. Never trusts a client-provided
 * discount — always recomputed here from persisted Bundle docs.
 */
export const applyBundleDiscountsForSellers = async (orderItems = []) => {
  const sellerIds = Array.from(
    new Set((orderItems || []).map((item) => String(item?.snapshot?.shopId || '')).filter(Boolean))
  );
  if (!sellerIds.length) return { orderItems, appliedBundles: [] };

  const bundles = await Bundle.find({ sellerId: { $in: sellerIds }, active: true }).lean();
  return applyBundleDiscounts(orderItems, bundles);
};

/**
 * Pure discount-application step, kept separate from the DB fetch above so it
 * stays easy to unit test.
 */
export const applyBundleDiscounts = (orderItems = [], bundles = []) => {
  if (!Array.isArray(bundles) || !bundles.length || !Array.isArray(orderItems) || !orderItems.length) {
    return { orderItems, appliedBundles: [] };
  }

  const itemsByProductId = new Map();
  orderItems.forEach((item) => {
    const pid = String(item?.product || '');
    if (!pid) return;
    if (!itemsByProductId.has(pid)) itemsByProductId.set(pid, []);
    itemsByProductId.get(pid).push(item);
  });

  const appliedBundles = [];
  for (const bundle of bundles) {
    const requiredIds = Array.isArray(bundle.productIds) ? bundle.productIds.map(String) : [];
    if (requiredIds.length < 2) continue;

    const matchedItems = [];
    let allPresent = true;
    for (const pid of requiredIds) {
      const candidates = (itemsByProductId.get(pid) || []).filter(
        (item) => String(item?.snapshot?.shopId || '') === String(bundle.sellerId)
      );
      if (!candidates.length) {
        allPresent = false;
        break;
      }
      matchedItems.push(candidates[0]);
    }
    if (!allPresent) continue;

    const discountPercent = Math.max(0, Math.min(90, Number(bundle.discountPercent) || 0));
    if (discountPercent <= 0) continue;

    // An item already discounted by another matched bundle (or already priced
    // via a filled group buy) keeps that price — discounts don't stack.
    const itemsToDiscount = matchedItems.filter(
      (item) => !item.snapshot?.bundleApplied && !item.snapshot?.groupBuyApplied
    );
    if (!itemsToDiscount.length) continue;

    itemsToDiscount.forEach((item) => {
      const baseLineTotal = Number(item.lineTotal || 0);
      const discountedLineTotal = Number((baseLineTotal * (1 - discountPercent / 100)).toFixed(2));
      item.lineTotal = discountedLineTotal;
      item.unitPrice = item.quantity > 0
        ? Number((discountedLineTotal / item.quantity).toFixed(2))
        : item.unitPrice;
      item.snapshot = {
        ...item.snapshot,
        bundleApplied: true,
        bundleId: bundle._id,
        bundleDiscountPercent: discountPercent
      };
    });
    appliedBundles.push({ bundleId: bundle._id, discountPercent, productIds: requiredIds });
  }

  return { orderItems, appliedBundles };
};

/**
 * Get frequently bought together products from the same seller.
 */
export const getBundleSuggestions = async (productId, { limit = 4 } = {}) => {
  const product = await Product.findById(productId)
    .select('title price user images category')
    .lean();
  if (!product) return { product: null, bundle: [], totalPrice: 0, bundlePrice: 0, savings: 0 };

  const sellerId = product.user;

  // Find completed orders containing this product from this seller
  const completedStatuses = [
    'delivery_proof_submitted', 'delivered', 'picked_up_confirmed',
    'confirmed_by_client', 'completed'
  ];

  const relatedOrders = await Order.find({
    seller: sellerId,
    status: { $in: completedStatuses },
    'items.product': { $ne: productId }
  })
    .select('items.product')
    .limit(500)
    .lean();

  if (!relatedOrders.length) {
    return {
      product: formatProductBundle(product),
      bundle: [],
      totalPrice: product.price,
      bundlePrice: product.price,
      savings: 0
    };
  }

  // Count co-occurrences
  const frequencyMap = new Map();
  for (const order of relatedOrders) {
    const seenInOrder = new Set();
    for (const item of order.items || []) {
      const pid = String(item.product || '');
      if (!pid || pid === String(productId)) continue;
      if (seenInOrder.has(pid)) continue;
      seenInOrder.add(pid);
      frequencyMap.set(pid, (frequencyMap.get(pid) || 0) + 1);
    }
  }

  // Sort by frequency, get top products
  const sorted = [...frequencyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (!sorted.length) {
    return {
      product: formatProductBundle(product),
      bundle: [],
      totalPrice: product.price,
      bundlePrice: product.price,
      savings: 0
    };
  }

  // Fetch the top co-occurring products from the same seller
  const coProductIds = sorted.map(([id]) => id);
  const coProducts = await Product.find({
    _id: { $in: coProductIds },
    user: sellerId,
    status: 'approved',
    isActive: { $ne: false }
  })
    .select('title price images slug')
    .limit(limit)
    .lean();

  // Maintain frequency sort order
  const idToFreq = Object.fromEntries(sorted);
  coProducts.sort((a, b) => (idToFreq[String(b._id)] || 0) - (idToFreq[String(a._id)] || 0));

  const mainProduct = formatProductBundle(product);
  const bundleItems = coProducts.slice(0, 3).map(formatProductBundle);

  const totalPrice = mainProduct.price + bundleItems.reduce((s, p) => s + p.price, 0);
  const bundlePrice = Math.round(totalPrice * (1 - BUNDLE_DISCOUNT_PCT / 100));
  const savings = totalPrice - bundlePrice;

  // Persist this exact product set so the discount shown here is the one
  // enforced at checkout (see applyBundleDiscountsForSellers in orderController).
  void syncAutoBundle({
    sellerId,
    productIds: [mainProduct._id, ...bundleItems.map((p) => p._id)],
    discountPercent: BUNDLE_DISCOUNT_PCT
  });

  return {
    product: mainProduct,
    bundle: bundleItems,
    totalPrice,
    bundlePrice,
    savings,
    discountPercent: BUNDLE_DISCOUNT_PCT
  };
};

const formatProductBundle = (p) => ({
  _id: p._id,
  title: p.title,
  price: p.price,
  image: Array.isArray(p.images) ? p.images[0] || '' : (p.image || ''),
  slug: p.slug
});
