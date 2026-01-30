import Order from '../models/orderModel.js';
import Rating from '../models/ratingModel.js';
import Comment from '../models/commentModel.js';
import Notification from '../models/notificationModel.js';
import { createNotification } from './notificationService.js';

/**
 * Check for delivered orders that are 1 hour old and send review reminders
 * to buyers who haven't reviewed the products yet
 */
export const sendReviewReminders = async () => {
  try {
    // Find orders delivered more than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const deliveredOrders = await Order.find({
      status: 'delivered',
      deliveredAt: { $exists: true, $lte: oneHourAgo },
      isDraft: false
    })
      .populate('customer', 'name email')
      .populate('items.product', 'title slug')
      .lean();

    if (!deliveredOrders || deliveredOrders.length === 0) {
      return { processed: 0, sent: 0 };
    }

    let processed = 0;
    let sent = 0;

    for (const order of deliveredOrders) {
      if (!order.customer || !order.items || order.items.length === 0) {
        continue;
      }

      const customerId = order.customer._id || order.customer;
      const orderId = order._id;

      // Check if we already sent a review reminder for this order
      const existingReminder = await Notification.findOne({
        user: customerId,
        type: 'review_reminder',
        'metadata.orderId': orderId.toString()
      }).lean();

      if (existingReminder) {
        // Already sent a reminder for this order
        processed++;
        continue;
      }

      // Get all product IDs from the order
      const productIds = order.items
        .map((item) => item.product?._id || item.product)
        .filter(Boolean);

      if (productIds.length === 0) {
        continue;
      }

      // Check which products the customer hasn't reviewed yet
      const [existingRatings, existingComments] = await Promise.all([
        Rating.find({
          user: customerId,
          product: { $in: productIds }
        })
          .select('product')
          .lean(),
        Comment.find({
          user: customerId,
          product: { $in: productIds }
        })
          .select('product')
          .lean()
      ]);

      const ratedProductIds = new Set(
        existingRatings.map((r) => r.product?.toString() || r.product)
      );
      const commentedProductIds = new Set(
        existingComments.map((c) => c.product?.toString() || c.product)
      );

      // Find products that haven't been reviewed (no rating AND no comment)
      const unreviewedProducts = order.items.filter((item) => {
        const productId = (item.product?._id || item.product)?.toString();
        if (!productId) return false;
        return !ratedProductIds.has(productId) && !commentedProductIds.has(productId);
      });

      if (unreviewedProducts.length === 0) {
        // Customer has already reviewed all products
        processed++;
        continue;
      }

      // Get product details for the notification
      const productDetails = unreviewedProducts
        .slice(0, 3) // Limit to first 3 products in notification
        .map((item) => ({
          id: item.product?._id || item.product,
          title: item.snapshot?.title || item.product?.title || 'Produit',
          slug: item.product?.slug || null
        }));

      // Send notification to the buyer
      try {
        await createNotification({
          userId: customerId,
          actorId: customerId, // Self-triggered notification
          productId: productDetails[0]?.id, // First product as primary reference
          type: 'review_reminder',
          metadata: {
            orderId: orderId.toString(),
            orderCode: order.deliveryCode || null,
            products: productDetails,
            productCount: unreviewedProducts.length,
            deliveredAt: order.deliveredAt
          },
          allowSelf: true // Allow self-notifications for review reminders
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send review reminder for order ${orderId}:`, error);
      }

      processed++;
    }

    return { processed, sent };
  } catch (error) {
    console.error('Error in sendReviewReminders:', error);
    throw error;
  }
};

/**
 * Check if a specific order needs a review reminder
 */
export const checkOrderReviewReminder = async (orderId) => {
  try {
    const order = await Order.findById(orderId)
      .populate('customer', 'name email')
      .populate('items.product', 'title slug')
      .lean();

    if (!order || order.status !== 'delivered' || !order.deliveredAt) {
      return { needsReminder: false, reason: 'Order not delivered' };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (order.deliveredAt > oneHourAgo) {
      return { needsReminder: false, reason: 'Less than 1 hour since delivery' };
    }

    if (!order.customer || !order.items || order.items.length === 0) {
      return { needsReminder: false, reason: 'Invalid order data' };
    }

    const customerId = order.customer._id || order.customer;
    const productIds = order.items
      .map((item) => item.product?._id || item.product)
      .filter(Boolean);

    if (productIds.length === 0) {
      return { needsReminder: false, reason: 'No products in order' };
    }

    // Check which products haven't been reviewed
    const [existingRatings, existingComments] = await Promise.all([
      Rating.find({
        user: customerId,
        product: { $in: productIds }
      })
        .select('product')
        .lean(),
      Comment.find({
        user: customerId,
        product: { $in: productIds }
      })
        .select('product')
        .lean()
    ]);

    const ratedProductIds = new Set(
      existingRatings.map((r) => r.product?.toString() || r.product)
    );
    const commentedProductIds = new Set(
      existingComments.map((c) => c.product?.toString() || c.product)
    );

    const unreviewedProducts = order.items.filter((item) => {
      const productId = (item.product?._id || item.product)?.toString();
      if (!productId) return false;
      return !ratedProductIds.has(productId) && !commentedProductIds.has(productId);
    });

    if (unreviewedProducts.length === 0) {
      return { needsReminder: false, reason: 'All products already reviewed' };
    }

    return {
      needsReminder: true,
      unreviewedCount: unreviewedProducts.length,
      totalProducts: order.items.length
    };
  } catch (error) {
    console.error('Error in checkOrderReviewReminder:', error);
    throw error;
  }
};
