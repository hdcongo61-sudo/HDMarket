/**
 * Engagement Service — Smart Notifications & Re-Engagement Engine
 * Proposal 8 of HDMarket Taobao-Inspired Improvements
 *
 * Handles:
 *  - Price drop detection (favorited product price ↓ > 10%)
 *  - Back-in-stock alerts (product disabled→approved, was favorited)
 *  - Abandoned cart reminders (cart items > 0, no activity 24h+)
 *  - Seller new product (followed shop adds product)
 *  - Review reminders (3 days after delivery, no review left)
 *  - Weekly digest (top deals + new products from followed shops)
 */

import Cart from '../models/cartModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import { createNotification } from '../utils/notificationService.js';

// ─── CONSTANTS ────────────────────────────────────────────────
const PRICE_DROP_THRESHOLD_PCT = 10; // Notify if price drops ≥ 10%
const BACK_IN_STOCK_LOOKBACK_DAYS = 30; // Only notify for products re-approved within 30 days
const ABANDONED_CART_HOURS = 24; // Cart inactive for 24h+
const REVIEW_REMINDER_DAYS = 3; // 3 days after delivery
const MAX_NOTIFICATIONS_PER_RUN = 500; // Safety cap per sweep

const REVIEW_ELIGIBLE_STATUSES = [
  'delivery_proof_submitted',
  'delivered',
  'picked_up_confirmed',
  'confirmed_by_client',
  'completed'
];

// ─── HELPERS ──────────────────────────────────────────────────

const batchProcess = async (items, batchSize, handler) => {
  const results = { processed: 0, errors: 0, notificationsSent: 0 };
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results_1 = await Promise.allSettled(batch.map(handler));
    for (const result of results_1) {
      if (result.status === 'fulfilled' && result.value) {
        results.notificationsSent += result.value.sent || 0;
        results.processed += 1;
      } else if (result.status === 'rejected') {
        results.errors += 1;
      } else {
        results.processed += 1;
      }
    }
  }
  return results;
};

const userPrefers = (user, type) => {
  if (!user?.notificationPreferences) return true;
  const prefs = user.notificationPreferences;
  if (typeof prefs.get === 'function') {
    return prefs.get(type) !== false;
  }
  return prefs[type] !== false;
};

// ─── 1. PRICE DROP DETECTION ─────────────────────────────────

export const sweepPriceDrops = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  const now = new Date();
  const sent = 0;

  // Find all products that have a discount > 0
  const discountedProducts = await Product.find({
    discount: { $gt: 0 },
    status: 'approved',
    isActive: { $ne: false }
  })
    .select('_id title price discount priceBeforeDiscount category slug')
    .lean()
    .limit(Math.min(limit, 1000));

  if (!discountedProducts.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_discounted_products' };

  // For each discounted product, find users who have it in favorites
  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  for (const product of discountedProducts) {
    if (notificationsSent >= limit) break;
    processed += 1;

    const currentPrice = Number(product.price || 0);
    const beforeDiscount = Number(product.priceBeforeDiscount || 0);
    const discount = Number(product.discount || 0);

    // Only notify if the price actually dropped significantly
    if (beforeDiscount <= 0 || discount < PRICE_DROP_THRESHOLD_PCT) continue;

    try {
      // Find users who favorited this product
      const favoritedBy = await User.find({
        favorites: product._id,
        notificationPreferences: { $ne: null }
      })
        .select('_id notificationPreferences')
        .lean()
        .limit(200);

      for (const user of favoritedBy) {
        if (notificationsSent >= limit) break;
        if (!userPrefers(user, 'price_drop')) continue;

        const saved = beforeDiscount - currentPrice;
        const pctDown = Math.round((saved / beforeDiscount) * 100);

        await createNotification({
          userId: user._id,
          actorId: user._id, // self-notification
          productId: product._id,
          type: 'price_drop',
          allowSelf: true,
          priority: 'NORMAL',
          pushEnabled: true,
          metadata: {
            productTitle: product.title,
            productSlug: product.slug,
            oldPrice: beforeDiscount,
            newPrice: currentPrice,
            saved,
            pctDown,
            category: product.category
          },
          entityType: 'product',
          entityId: String(product._id),
          deepLink: `/product/${product.slug || product._id}`
        });
        notificationsSent += 1;
      }
    } catch (err) {
      errors += 1;
      console.error('[engagement] price-drop error for product', product._id, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};

// ─── 2. BACK-IN-STOCK DETECTION ──────────────────────────────

export const sweepBackInStock = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - BACK_IN_STOCK_LOOKBACK_DAYS);

  // Find products recently approved (status became 'approved' recently)
  const reApproved = await Product.find({
    status: 'approved',
    isActive: { $ne: false },
    updatedAt: { $gte: cutoffDate }
  })
    .select('_id title slug category')
    .lean()
    .limit(Math.min(limit, 1000));

  if (!reApproved.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_reapproved_products' };

  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  for (const product of reApproved) {
    if (notificationsSent >= limit) break;
    processed += 1;

    try {
      const favoritedBy = await User.find({
        favorites: product._id,
        notificationPreferences: { $ne: null }
      })
        .select('_id notificationPreferences')
        .lean()
        .limit(200);

      for (const user of favoritedBy) {
        if (notificationsSent >= limit) break;
        if (!userPrefers(user, 'back_in_stock')) continue;

        await createNotification({
          userId: user._id,
          actorId: user._id,
          productId: product._id,
          type: 'back_in_stock',
          allowSelf: true,
          priority: 'HIGH',
          pushEnabled: true,
          metadata: {
            productTitle: product.title,
            productSlug: product.slug,
            category: product.category
          },
          entityType: 'product',
          entityId: String(product._id),
          deepLink: `/product/${product.slug || product._id}`
        });
        notificationsSent += 1;
      }
    } catch (err) {
      errors += 1;
      console.error('[engagement] back-in-stock error for product', product._id, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};

// ─── 3. ABANDONED CART REMINDERS ─────────────────────────────

export const sweepAbandonedCarts = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  const cutoffTime = new Date(Date.now() - ABANDONED_CART_HOURS * 60 * 60 * 1000);

  // Find carts with items, last updated > 24h ago, user not notified recently
  const abandonedCarts = await Cart.find({
    'items.0': { $exists: true }, // has at least one item
    updatedAt: { $lte: cutoffTime }
  })
    .populate('user', '_id name notificationPreferences')
    .populate('items.product', '_id title slug price images')
    .lean()
    .limit(Math.min(limit, 500));

  if (!abandonedCarts.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_abandoned_carts' };

  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  for (const cart of abandonedCarts) {
    if (notificationsSent >= limit) break;
    processed += 1;

    const user = cart.user;
    if (!user || !userPrefers(user, 'abandoned_cart')) continue;

    const itemCount = (cart.items || []).length;
    const firstProduct = cart.items[0]?.product;
    const firstTitle = firstProduct?.title || 'articles';

    try {
      await createNotification({
        userId: user._id,
        actorId: user._id,
        productId: firstProduct?._id || null,
        type: 'abandoned_cart',
        allowSelf: true,
        priority: 'NORMAL',
        pushEnabled: true,
        metadata: {
          cartId: String(cart._id),
          itemCount,
          firstProductTitle: firstTitle,
          abandonedSince: cart.updatedAt
        },
        entityType: 'order',
        entityId: String(cart._id),
        deepLink: '/cart'
      });
      notificationsSent += 1;
    } catch (err) {
      errors += 1;
      console.error('[engagement] abandoned-cart error for user', user._id, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};

// ─── 4. SELLER NEW PRODUCT ───────────────────────────────────

export const sweepSellerNewProducts = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  const lookbackHours = 3; // Products added in last 3 hours (since we run every 3h)

  const cutoffTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Find recently approved products
  const newProducts = await Product.find({
    status: 'approved',
    isActive: { $ne: false },
    createdAt: { $gte: cutoffTime }
  })
    .select('_id title slug price category user')
    .populate('user', '_id shopName followersCount')
    .lean()
    .limit(Math.min(limit, 500));

  if (!newProducts.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_new_products' };

  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  // Group products by seller for batch notifying followers
  const sellerProductMap = new Map();
  for (const product of newProducts) {
    const sellerId = String(product.user?._id || '');
    if (!sellerId) continue;
    if (!sellerProductMap.has(sellerId)) {
      sellerProductMap.set(sellerId, {
        seller: product.user,
        products: []
      });
    }
    sellerProductMap.get(sellerId).products.push(product);
  }

  for (const [sellerId, entry] of sellerProductMap) {
    if (notificationsSent >= limit) break;

    const { seller, products } = entry;
    if (!seller?.shopName) continue;

    try {
      // Find followers of this shop
      const followers = await User.find({
        followingShops: sellerId,
        notificationPreferences: { $ne: null }
      })
        .select('_id notificationPreferences')
        .lean()
        .limit(300);

      for (const follower of followers) {
        if (notificationsSent >= limit) break;
        if (!userPrefers(follower, 'seller_new_product')) continue;

        const firstProduct = products[0];
        const shopName = seller.shopName || 'Une boutique';

        await createNotification({
          userId: follower._id,
          actorId: sellerId,
          productId: firstProduct._id,
          shopId: sellerId,
          type: 'seller_new_product',
          allowSelf: false,
          priority: 'LOW',
          pushEnabled: true,
          metadata: {
            shopName,
            newProductCount: products.length,
            firstProductTitle: firstProduct.title,
            firstProductSlug: firstProduct.slug,
            firstProductPrice: firstProduct.price
          },
          entityType: 'product',
          entityId: String(firstProduct._id),
          deepLink: `/product/${firstProduct.slug || firstProduct._id}`
        });
        notificationsSent += 1;
      }
    } catch (err) {
      errors += 1;
      console.error('[engagement] seller-new-product error for seller', sellerId, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};

// ─── 5. REVIEW REMINDERS ─────────────────────────────────────

export const sweepReviewReminders = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() - REVIEW_REMINDER_DAYS);

  // Find orders delivered ~3 days ago where no review was left
  const eligibleOrders = await Order.find({
    status: { $in: REVIEW_ELIGIBLE_STATUSES },
    updatedAt: {
      $gte: new Date(reminderDate.getTime() - 24 * 60 * 60 * 1000),
      $lte: reminderDate
    }
  })
    .select('_id customer seller items.snapshot.title items.product')
    .lean()
    .limit(Math.min(limit, 300));

  if (!eligibleOrders.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_eligible_orders' };

  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  for (const order of eligibleOrders) {
    if (notificationsSent >= limit) break;
    processed += 1;

    const buyerId = String(order.customer || '');
    if (!buyerId) continue;

    try {
      const buyer = await User.findById(buyerId)
        .select('_id notificationPreferences')
        .lean();
      if (!buyer || !userPrefers(buyer, 'review_reminder')) continue;

      const productTitle =
        order.items?.[0]?.snapshot?.title || order.items?.[0]?.product?.title || 'votre commande';
      const productId = order.items?.[0]?.product;

      await createNotification({
        userId: buyerId,
        actorId: buyerId,
        productId: productId || null,
        type: 'review_reminder',
        allowSelf: true,
        priority: 'NORMAL',
        pushEnabled: true,
        metadata: {
          orderId: String(order._id),
          productTitle,
          deliveredDaysAgo: REVIEW_REMINDER_DAYS
        },
        entityType: 'order',
        entityId: String(order._id),
        deepLink: `/orders/${order._id}/review${productId ? `?productId=${encodeURIComponent(String(productId))}` : ''}`
      });
      notificationsSent += 1;
    } catch (err) {
      errors += 1;
      console.error('[engagement] review-reminder error for order', order._id, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};

// ─── 6. WEEKLY DIGEST ────────────────────────────────────────

export const sendWeeklyDigest = async ({ limit = MAX_NOTIFICATIONS_PER_RUN } = {}) => {
  // Find users who opted in for weekly digest and have favorites or following shops
  const eligibleUsers = await User.find({
    isActive: { $ne: false },
    isBlocked: { $ne: true },
    $or: [
      { 'favorites.0': { $exists: true } },
      { 'followingShops.0': { $exists: true } }
    ]
  })
    .select('_id name notificationPreferences favorites followingShops city')
    .lean()
    .limit(Math.min(limit, 100));

  if (!eligibleUsers.length) return { processed: 0, errors: 0, notificationsSent: 0, summary: 'no_eligible_users' };

  let notificationsSent = 0;
  let processed = 0;
  let errors = 0;

  for (const user of eligibleUsers) {
    if (notificationsSent >= limit) break;
    processed += 1;

    if (!userPrefers(user, 'weekly_digest')) continue;

    try {
      // Get top deals from favorited products with discounts
      const favoriteIds = (user.favorites || []).slice(0, 100);
      const deals = favoriteIds.length
        ? await Product.find({
            _id: { $in: favoriteIds },
            status: 'approved',
            discount: { $gt: 5 }
          })
            .select('_id title price discount slug')
            .sort({ discount: -1 })
            .limit(5)
            .lean()
        : [];

      // Get new products from followed shops (last 7 days)
      const followingIds = (user.followingShops || []).slice(0, 50);
      const newFromFollowed = followingIds.length
        ? await Product.find({
            user: { $in: followingIds },
            status: 'approved',
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          })
            .select('_id title price slug user')
            .populate('user', 'shopName')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
        : [];

      // Get popular products in user's city
      const popularNearby = await Product.find({
        status: 'approved',
        city: user.city || 'Brazzaville'
      })
        .select('_id title price slug')
        .sort({ views: -1 })
        .limit(3)
        .lean();

      const dealCount = deals.length;
      const newCount = newFromFollowed.length;

      if (!dealCount && !newCount && !popularNearby.length) continue;

      const firstDeal = deals[0];
      const firstNew = newFromFollowed[0];

      await createNotification({
        userId: user._id,
        actorId: user._id,
        productId: firstDeal?._id || firstNew?._id || popularNearby[0]?._id || null,
        type: 'weekly_digest',
        allowSelf: true,
        priority: 'LOW',
        pushEnabled: true,
        metadata: {
          dealCount,
          newFromFollowedCount: newCount,
          popularCount: popularNearby.length,
          topDealTitle: firstDeal?.title || '',
          topDealSlug: firstDeal?.slug || '',
          topNewTitle: firstNew?.title || '',
          topNewSlug: firstNew?.slug || '',
          topNewShopName: firstNew?.user?.shopName || ''
        },
        entityType: 'product',
        entityId: String(firstDeal?._id || firstNew?._id || popularNearby[0]?._id || ''),
        deepLink: '/explore'
      });
      notificationsSent += 1;
    } catch (err) {
      errors += 1;
      console.error('[engagement] weekly-digest error for user', user._id, err.message);
    }
  }

  return { processed, errors, notificationsSent };
};
