import { buildProductPath, buildShopPath } from './links';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const URL_BASE = 'https://hdmarket.local';

const ORDER_TYPES = new Set([
  'order_created',
  'order_received',
  'order_reminder',
  'order_cancelled',
  'order_cancellation_window_skipped',
  'order_address_updated',
  'order_delivery_fee_updated',
  'order_message'
]);
const INSTALLMENT_TYPES = new Set([
  'installment_sale_confirmation_required',
  'installment_payment_submitted',
  'installment_sale_confirmed',
  'installment_payment_validated',
  'installment_completed',
  'installment_due_reminder',
  'installment_overdue_warning',
  'installment_product_suspended'
]);
const PRODUCT_REVIEW_TYPES = new Set(['product_comment', 'reply', 'rating', 'review_reminder']);
const SHOP_REVIEW_TYPES = new Set(['shop_review']);
const DISPUTE_TYPES = new Set([
  'dispute_created',
  'dispute_seller_responded',
  'dispute_deadline_near',
  'dispute_under_review',
  'dispute_resolved'
]);
const DELIVERY_TYPES = new Set([
  'delivery_request_created',
  'delivery_request_accepted',
  'delivery_request_rejected',
  'delivery_request_assigned',
  'delivery_request_in_progress',
  'delivery_request_delivered',
  'order_delivering',
  'order_delivered'
]);

export const extractObjectId = (value, depth = 0) => {
  if (depth > 4 || value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return OBJECT_ID_REGEX.test(trimmed) ? trimmed : '';
  }
  if (typeof value === 'object') {
    const candidates = [value._id, value.id, value.$oid, value.orderId, value.value, value.requestId];
    for (const candidate of candidates) {
      const resolved = extractObjectId(candidate, depth + 1);
      if (resolved) return resolved;
    }
  }
  return '';
};

export const normalizeNotificationLink = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('[object Object]')) return '';
  if (ABSOLUTE_URL_REGEX.test(raw)) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
};

const toUrlObject = (link) => {
  const normalized = normalizeNotificationLink(link);
  if (!normalized) return null;
  try {
    return {
      isAbsolute: ABSOLUTE_URL_REGEX.test(normalized),
      url: new URL(normalized, URL_BASE)
    };
  } catch {
    return null;
  }
};

const fromUrlObject = (parsed) => {
  if (!parsed?.url) return '';
  return parsed.isAbsolute
    ? parsed.url.toString()
    : `${parsed.url.pathname}${parsed.url.search}${parsed.url.hash}`;
};

const mergeQueryAndHash = (link, params = {}, hash = '') => {
  const parsed = toUrlObject(link);
  if (!parsed) return '';
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    parsed.url.searchParams.set(key, String(value));
  });
  if (hash) {
    parsed.url.hash = hash.startsWith('#') ? hash : `#${hash}`;
  }
  return fromUrlObject(parsed);
};

const userIsBackoffice = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || role === 'founder' || role === 'manager';
};

const userIsSeller = (user) => {
  const role = String(user?.role || '').toLowerCase();
  const accountType = String(user?.accountType || '').toLowerCase();
  return role === 'seller' || accountType === 'shop';
};

const userIsCourier = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'delivery_agent' || role === 'courier';
};

const buildProductIdentifier = (alert) => {
  const product = alert?.product || {};
  const metadata = alert?.metadata || {};
  if (product?._id || product?.slug || product?.id) return product;
  const productSlug = String(metadata.productSlug || metadata.slug || '').trim();
  const productId = extractObjectId(metadata.productId) || extractObjectId(alert?.entityId);
  if (productSlug || productId) {
    return { slug: productSlug || undefined, _id: productId || undefined };
  }
  return null;
};

const buildShopIdentifier = (alert) => {
  const shop = alert?.shop || {};
  const metadata = alert?.metadata || {};
  if (shop?._id || shop?.slug || shop?.id) return shop;
  const shopSlug = String(metadata.shopSlug || metadata.slug || '').trim();
  const shopId = extractObjectId(metadata.shopId) || extractObjectId(alert?.entityId);
  if (shopSlug || shopId) {
    return { slug: shopSlug || undefined, _id: shopId || undefined };
  }
  return null;
};

const buildOrderPath = (alert, user) => {
  const metadata = alert?.metadata || {};
  const orderId =
    extractObjectId(metadata.orderId) ||
    extractObjectId(alert?.entityType === 'order' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId);
  if (alert?.type === 'order_message') {
    if (!orderId) return '/orders/messages';
    return `/orders/messages?orderId=${encodeURIComponent(orderId)}`;
  }
  if (!orderId) return '';
  if (userIsBackoffice(user)) return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  if (userIsSeller(user)) return `/seller/orders/detail/${orderId}`;
  return `/orders/detail/${orderId}`;
};

const buildDisputePath = (alert, user) => {
  if (!DISPUTE_TYPES.has(String(alert?.type || ''))) return '';
  const metadata = alert?.metadata || {};
  const disputeId =
    extractObjectId(metadata.disputeId) ||
    extractObjectId(alert?.entityType === 'dispute' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId);
  if (userIsBackoffice(user)) {
    return disputeId ? `/admin/complaints?disputeId=${encodeURIComponent(disputeId)}` : '/admin/complaints';
  }
  if (userIsSeller(user)) return '/seller/disputes';
  return '/reclamations';
};

const buildDeliveryPath = (alert, user) => {
  if (!DELIVERY_TYPES.has(String(alert?.type || ''))) return '';
  const metadata = alert?.metadata || {};
  const deliveryRequestId =
    extractObjectId(metadata.deliveryRequestId) ||
    extractObjectId(metadata.requestId) ||
    extractObjectId(alert?.entityType === 'deliveryRequest' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId);
  if (userIsBackoffice(user)) {
    return deliveryRequestId
      ? `/admin/delivery-requests?requestId=${encodeURIComponent(deliveryRequestId)}`
      : '/admin/delivery-requests';
  }
  if (userIsCourier(user)) {
    return deliveryRequestId
      ? `/delivery/assignment/${encodeURIComponent(deliveryRequestId)}`
      : '/delivery/dashboard';
  }
  return buildOrderPath(alert, user) || '/orders';
};

const buildProductReviewsPath = (alert) => {
  const productIdentifier = buildProductIdentifier(alert);
  let path = productIdentifier ? buildProductPath(productIdentifier) : '';
  if (!path) {
    path = normalizeNotificationLink(
      alert?.actionLink || alert?.deepLink || alert?.metadata?.deepLink || ''
    );
  }
  if (!path || !path.includes('/product/')) return '';

  const metadata = alert?.metadata || {};
  const commentId =
    extractObjectId(metadata.commentId) ||
    extractObjectId(metadata.parentId) ||
    extractObjectId(metadata.replyId);
  return mergeQueryAndHash(
    path,
    {
      tab: 'reviews',
      open: 'comments',
      ...(commentId ? { commentId } : {})
    },
    'comments'
  );
};

const buildShopReviewsPath = (alert) => {
  const shopIdentifier = buildShopIdentifier(alert);
  let path = shopIdentifier ? buildShopPath(shopIdentifier) : '';
  if (!path) {
    path = normalizeNotificationLink(
      alert?.actionLink || alert?.deepLink || alert?.metadata?.deepLink || ''
    );
  }
  if (!path || !path.includes('/shop/')) return '';
  const metadata = alert?.metadata || {};
  const reviewId = extractObjectId(metadata.reviewId);
  return mergeQueryAndHash(path, reviewId ? { reviewId } : {}, 'reviews');
};

export const resolveNotificationLink = (alert, user = null) => {
  if (!alert) return '';
  const type = String(alert?.type || '').trim();
  const deepLink = normalizeNotificationLink(
    alert?.actionLink || alert?.deepLink || alert?.metadata?.deepLink || ''
  );

  if (type === 'order_message') {
    if (deepLink && deepLink.includes('/orders/messages')) return deepLink;
    return buildOrderPath(alert, user);
  }

  if (PRODUCT_REVIEW_TYPES.has(type)) {
    return buildProductReviewsPath(alert) || deepLink || buildOrderPath(alert, user);
  }

  if (SHOP_REVIEW_TYPES.has(type)) {
    return buildShopReviewsPath(alert) || deepLink;
  }

  if (type === 'payment_pending' && userIsBackoffice(user)) {
    return deepLink || '/admin/payment-verification?status=waiting';
  }

  if (type === 'validation_required') {
    return deepLink || '/admin/task-center';
  }

  if (DISPUTE_TYPES.has(type)) {
    return deepLink || buildDisputePath(alert, user);
  }

  if (DELIVERY_TYPES.has(type)) {
    return deepLink || buildDeliveryPath(alert, user);
  }

  if (ORDER_TYPES.has(type) || INSTALLMENT_TYPES.has(type)) {
    return deepLink || buildOrderPath(alert, user) || '/orders';
  }

  if (type === 'shop_follow' || type === 'shop_boosted' || type === 'shop_verified') {
    const shopIdentifier = buildShopIdentifier(alert);
    return deepLink || (shopIdentifier ? buildShopPath(shopIdentifier) : '');
  }

  if (type === 'product_boosted' || type === 'product_approval' || type === 'product_rejection') {
    const productIdentifier = buildProductIdentifier(alert);
    return deepLink || (productIdentifier ? buildProductPath(productIdentifier) : '');
  }

  if (deepLink) return deepLink;

  const productIdentifier = buildProductIdentifier(alert);
  if (productIdentifier) return buildProductPath(productIdentifier);
  const shopIdentifier = buildShopIdentifier(alert);
  if (shopIdentifier) return buildShopPath(shopIdentifier);

  return '';
};

export const resolvePushPayloadLink = (payload, user = null) => {
  const data = payload?.notification?.data || payload?.data || payload || {};
  const syntheticAlert = {
    type: String(data.type || '').trim(),
    deepLink: data.actionLink || data.deepLink || data.deeplink || data.url || data.link || data.path || '',
    actionLink: data.actionLink || data.deepLink || data.deeplink || data.url || data.link || data.path || '',
    entityType: data.entityType || '',
    entityId: data.entityId || '',
    metadata: {
      ...data,
      orderId: data.orderId || '',
      productId: data.productId || '',
      shopId: data.shopId || '',
      commentId: data.commentId || '',
      reviewId: data.reviewId || '',
      disputeId: data.disputeId || '',
      requestId: data.deliveryRequestId || data.requestId || ''
    },
    product: data.productSlug || data.productId ? { slug: data.productSlug, _id: data.productId } : null,
    shop: data.shopSlug || data.shopId ? { slug: data.shopSlug, _id: data.shopId } : null
  };
  return (
    resolveNotificationLink(syntheticAlert, user) ||
    normalizeNotificationLink(data.actionLink || data.deepLink || data.deeplink || data.url || data.link || data.path || '')
  );
};
