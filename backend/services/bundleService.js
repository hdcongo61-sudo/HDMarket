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

const BUNDLE_DISCOUNT_PCT = 5; // 5% off when buying as bundle

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
