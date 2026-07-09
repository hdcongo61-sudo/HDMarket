import DeliveryLog from '../models/deliveryLogModel.js';
import Order from '../models/orderModel.js';
import Payment from '../models/paymentModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import {
  invalidateAdminCache,
  invalidateProductCache,
  invalidateSellerCache,
  invalidateUserCache
} from '../utils/cache.js';
import {
  createNotification,
  resolveValidationTaskNotifications
} from '../utils/notificationService.js';
import { ensureModelSlugsForItems } from '../utils/slugUtils.js';
import { calculateProductSalesCount } from '../utils/salesCalculator.js';
import { isTwilioMessagingConfigured, sendSms } from '../utils/twilioMessaging.js';
import { safeAsync } from '../utils/safeAsync.js';
import {
  cancelOrderReviewReminder,
  isOrderEligibleForReviewReminder,
  scheduleOrderReviewReminder
} from './orderReviewReminderService.js';

const uniqueStrings = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '')).filter(Boolean)));

const invalidateOrderCaches = async ({ customerId, sellerIds = [], includeAdmin = true }) => {
  const sellers = uniqueStrings(sellerIds);

  if (customerId) {
    await invalidateUserCache(customerId, ['orders', 'notifications', 'dashboard', 'analytics']);
  }

  if (sellers.length) {
    await Promise.all(
      sellers.map((sellerId) => invalidateSellerCache(sellerId, ['orders', 'dashboard', 'analytics']))
    );
  }

  if (includeAdmin) {
    await invalidateAdminCache(['admin', 'dashboard', 'analytics']);
  }
};

const ensureOrderSlugs = async (orderIds = []) => {
  const ids = uniqueStrings(orderIds);
  if (!ids.length) return;

  const orders = await Order.find({ _id: { $in: ids } })
    .populate('items.product', 'title')
    .select('items.product')
    .lean();
  const seen = new Set();
  const products = [];
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const product = item?.product;
      const productId = String(product?._id || product || '');
      if (!productId || seen.has(productId) || typeof product !== 'object') return;
      seen.add(productId);
      products.push(product);
    });
  });

  if (products.length) {
    await ensureModelSlugsForItems({ Model: Product, items: products, sourceValueKey: 'title' });
  }
};

const syncReviewReminder = async (orderId) => {
  if (!orderId) return;
  const order = await Order.findById(orderId);
  if (!order) return;
  if (isOrderEligibleForReviewReminder(order)) {
    await scheduleOrderReviewReminder(order._id);
    return;
  }
  await cancelOrderReviewReminder(order._id);
};

const createNotifications = async (notifications = []) => {
  const list = Array.isArray(notifications) ? notifications : [];
  if (!list.length) return;
  await Promise.all(list.map((payload) => createNotification(payload)));
};

const sendSmsMessages = async (messages = []) => {
  if (!isTwilioMessagingConfigured()) return;
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return;
  await Promise.all(
    list.map(async (entry) => {
      let phone = entry.phone;
      if (!phone && entry.userId) {
        const user = await User.findById(entry.userId).select('phone').lean();
        phone = user?.phone || '';
      }
      if (!phone) return null;
      return sendSms(phone, entry.message).catch((error) => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Queued SMS failed', entry.context, error?.message || error);
        }
      });
    })
  );
};

const recalculateSalesCounts = async (productIds = []) => {
  const ids = uniqueStrings(productIds);
  for (const productId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const salesCount = await calculateProductSalesCount(productId);
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: productId }, { $set: { salesCount } });
  }
};

const processPaymentSubmission = async (data = {}) => {
  const [moderators, waitingCount] = await Promise.all([
    User.find({ role: { $in: ['admin', 'founder', 'manager'] } }).select('_id role').lean(),
    Payment.countDocuments({ status: 'waiting' })
  ]);

  const actorId = data.actorId || null;
  const notifications = moderators
    .filter((moderator) => String(moderator._id) !== String(actorId))
    .map((moderator) => ({
      userId: moderator._id,
      actorId,
      productId: data.productId,
      type: 'payment_pending',
      audience:
        String(moderator.role || '').toLowerCase() === 'founder'
          ? 'FOUNDER'
          : String(moderator.role || '').toLowerCase() === 'admin'
          ? 'ADMIN'
          : 'ROLE_GROUP',
      targetRole: [String(moderator.role || '').toUpperCase()],
      actionRequired: true,
      actionType: 'VERIFY',
      actionStatus: 'PENDING',
      deepLink: '/admin/payment-verification?status=waiting',
      actionLink: '/admin/payment-verification?status=waiting',
      entityType: 'payment',
      entityId: String(data.paymentId || ''),
      validationType: 'productValidation',
      metadata: {
        ...(data.metadata || {}),
        paymentType: data.metadata?.paymentType || 'LISTING_FEE',
        waitingCount
      }
    }));

  await createNotifications(notifications);
};

const processPaymentReview = async (data = {}) => {
  await safeAsync(() => invalidateProductCache(), { label: 'side_effect_payment_review_invalidate_product_cache' });

  if (data.notification) {
    await createNotification(data.notification);
  }

  if (data.paymentId) {
    await resolveValidationTaskNotifications({
      entityType: 'payment',
      entityId: String(data.paymentId),
      actionStatus: 'DONE',
      actorId: data.actorId,
      validationType: 'productValidation'
    });
  }
};

const processCheckout = async (data = {}) => {
  await safeAsync(() => ensureOrderSlugs(data.orderIds), { label: 'side_effect_checkout_slugs' });
  await safeAsync(() => createNotifications(data.notifications), { label: 'side_effect_checkout_notifications' });
  await safeAsync(() => sendSmsMessages(data.smsMessages), { label: 'side_effect_checkout_sms' });

  if (data.fullPaymentAdminNotifications?.length) {
    const admins = await User.find({ role: { $in: ['admin', 'manager', 'founder'] } }).select('_id').lean();
    const notifications = data.fullPaymentAdminNotifications.flatMap((template) =>
      admins.map((admin) => ({
        ...template,
        userId: admin._id
      }))
    );
    await safeAsync(() => createNotifications(notifications), {
      label: 'side_effect_checkout_full_payment_admin_notifications'
    });
  }

  await safeAsync(
    () =>
      invalidateOrderCaches({
        customerId: data.customerId,
        sellerIds: data.sellerIds,
        includeAdmin: true
      }),
    { label: 'side_effect_checkout_cache' }
  );
};

const processOrderLifecycle = async (data = {}) => {
  await safeAsync(() => syncReviewReminder(data.orderId), { label: 'side_effect_order_review_reminder' });

  if (data.deliveryLog) {
    await safeAsync(() => DeliveryLog.create(data.deliveryLog), { label: 'side_effect_order_delivery_log' });
  }

  await safeAsync(() => createNotifications(data.notifications), { label: 'side_effect_order_notifications' });
  await safeAsync(() => sendSmsMessages(data.smsMessages), { label: 'side_effect_order_sms' });
  await safeAsync(() => recalculateSalesCounts(data.recalculateSalesProductIds), {
    label: 'side_effect_order_sales_counts'
  });
  await safeAsync(() => ensureOrderSlugs([data.orderId]), { label: 'side_effect_order_slugs' });
  await safeAsync(
    () =>
      invalidateOrderCaches({
        customerId: data.customerId,
        sellerIds: data.sellerIds,
        includeAdmin: data.includeAdmin !== false
      }),
    { label: 'side_effect_order_cache' }
  );
};

export const processSideEffectJob = async ({ name, data }) => {
  switch (String(name || '')) {
    case 'payment-submission':
      return processPaymentSubmission(data);
    case 'payment-review':
      return processPaymentReview(data);
    case 'checkout':
      return processCheckout(data);
    case 'order-lifecycle':
      return processOrderLifecycle(data);
    default:
      return { skipped: true, reason: `Unknown side effect job: ${name}` };
  }
};
