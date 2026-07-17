import { buildProductPath, buildShopPath } from './links';
import { hasAnyPermission } from './permissions';

// Where admins / founders / granted users manage the platform ("app") wallet:
// deposits to verify, withdrawals to process, platform balance.
const APP_WALLET_PATH = '/admin/payments';

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const URL_BASE = 'https://hdmarket.local';

const ORDER_TYPES = new Set([
  'order_placed',
  'order_created',
  'order_received',
  'order_accepted',
  'order_rejected',
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
const PRODUCT_REVIEW_TYPES = new Set(['product_comment', 'reply', 'rating']);
const SHOP_REVIEW_TYPES = new Set(['shop_review']);
const COMPLAINT_TYPES = new Set(['complaint_created', 'complaint_resolved']);
const FEEDBACK_TYPES = new Set(['feedback_read', 'improvement_feedback_created']);
const SHOP_CONVERSION_TYPES = new Set([
  'shop_conversion_request',
  'shop_conversion_approved',
  'shop_conversion_rejected'
]);
const DISPUTE_TYPES = new Set([
  'dispute_created',
  'dispute_seller_responded',
  'dispute_deadline_near',
  'dispute_under_review',
  'dispute_resolved'
]);
const DELIVERY_TYPES = new Set([
  'delivery_assigned',
  'delivery_in_progress',
  'delivery_completed',
  'delivery_request_created',
  'delivery_request_accepted',
  'delivery_request_rejected',
  'delivery_request_assigned',
  'delivery_request_in_progress',
  'delivery_request_delivered',
  'order_delivering',
  'order_delivered'
]);
const PRODUCT_TYPES = new Set([
  'favorite',
  'product_approval',
  'product_approved',
  'product_rejection',
  'product_rejected',
  'product_certified',
  'product_boosted',
  'boost_expired',
  'promotional',
  'promo_expired'
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

const getParsedNotificationLink = (link) => toUrlObject(link)?.url || null;

const isOrderScopedLink = (link) => {
  const pathname = String(getParsedNotificationLink(link)?.pathname || '').toLowerCase();
  return (
    pathname.startsWith('/orders') ||
    pathname.startsWith('/order') ||
    pathname.startsWith('/seller/orders') ||
    pathname.startsWith('/seller/order') ||
    pathname.startsWith('/admin/orders')
  );
};

const extractOrderIdFromLink = (link) => {
  const parsed = getParsedNotificationLink(link);
  if (!parsed) return '';

  const orderIdFromQuery =
    extractObjectId(parsed.searchParams.get('orderId')) ||
    extractObjectId(parsed.searchParams.get('id'));
  if (orderIdFromQuery) return orderIdFromQuery;

  const match = parsed.pathname.match(
    /\/(?:seller\/orders\/detail|seller\/order\/detail|orders\/detail|order\/detail|orders)\/([a-f\d]{24})(?:\/|$)/i
  );
  return match?.[1] || '';
};

const BUYER_SIDE_ORDER_TYPES = new Set([
  'order_created',
  'order_placed',
  'order_delivering',
  'order_delivered',
  'review_reminder',
  'installment_due_reminder',
  'installment_overdue_warning',
  'installment_payment_validated',
  'installment_completed',
  'installment_product_suspended',
  'order_full_payment_waived',
  'order_cancellation_window_skipped'
]);

const SELLER_SIDE_ORDER_TYPES = new Set([
  'order_received',
  'order_accepted',
  'order_rejected',
  'order_reminder',
  'payment_pending',
  'payment_proof_submitted',
  'installment_payment_submitted',
  'installment_sale_confirmation_required',
  'installment_sale_confirmed',
  'order_address_updated',
  'order_delivery_fee_updated',
  'order_full_payment_received',
  'order_full_payment_ready'
]);

const WALLET_LINK_TYPES = new Set([
  'wallet_deposit',
  'wallet_withdrawal',
  'wallet_refund',
  'wallet_credit',
  'wallet_debit'
]);

const buildOrderPath = (alert, user, fallbackOrderId = '') => {
  const metadata = alert?.metadata || {};
  const orderId =
    extractObjectId(metadata.orderId) ||
    extractObjectId(alert?.entityType === 'order' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId) ||
    extractObjectId(fallbackOrderId);
  if (alert?.type === 'order_message') {
    if (!orderId) return '/orders/messages';
    return `/orders/messages?orderId=${encodeURIComponent(orderId)}`;
  }
  if (!orderId) return '';

  // If user is explicitly the customer of this order, always route to buyer page
  const userCustomerId = String(user?._id || user?.id || '').trim();
  const orderCustomerId = String(metadata.customerId || '').trim();
  const userIsOrderCustomer = Boolean(userCustomerId && orderCustomerId && userCustomerId === orderCustomerId);

  if (userIsBackoffice(user)) return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  // User is the buyer — always route to buyer page regardless of role/accountType
  if (userIsOrderCustomer) return `/orders/detail/${orderId}`;
  // User is a seller/shop and NOT the customer — determine route
  if (userIsSeller(user)) {
    // Fallback for old notifications without customerId: guess from notification type
    if (!orderCustomerId && BUYER_SIDE_ORDER_TYPES.has(String(alert?.type || ''))) {
      return `/orders/detail/${orderId}`;
    }
    return `/seller/orders/detail/${orderId}`;
  }
  return `/orders/detail/${orderId}`;
};

const isWalletNotification = (alert) => {
  const type = String(alert?.type || '').trim();
  const metadata = alert?.metadata || {};
  const entityType = String(alert?.entityType || '').trim().toLowerCase();
  const link = String(alert?.actionLink || alert?.deepLink || metadata?.deepLink || '').trim().toLowerCase();
  const message = String(metadata?.message || alert?.message || '').trim().toLowerCase();
  const metadataValues = [
    metadata.walletId,
    metadata.walletBalance,
    metadata.pendingBalance,
    metadata.availableBalance,
    metadata.transactionId,
    metadata.paymentSource,
    metadata.reference,
    metadata.role
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .join(' ');

  return (
    WALLET_LINK_TYPES.has(type) ||
    entityType === 'wallet' ||
    Boolean(metadata.walletId || metadata.walletBalance !== undefined || metadata.pendingBalance !== undefined || metadata.availableBalance !== undefined) ||
    link.startsWith('/wallet') ||
    link.includes('/wallet') ||
    metadataValues.includes('wallet') ||
    metadataValues.includes('portefeuille') ||
    message.includes('portefeuille') ||
    message.includes('hdmarket wallet')
  );
};

// Can this recipient act on the platform/app wallet (verify deposits, process
// withdrawals)? Founders + admins/managers, or anyone granted the permission.
const userCanManageAppWallet = (user) =>
  userIsBackoffice(user) ||
  user?.canVerifyPayments === true ||
  hasAnyPermission(user, ['verify_payments', 'manage_payments', 'manage_wallet']);

// Distinguishes an "app/platform wallet" alert (a deposit/withdrawal the admin
// must process, or any admin-scoped wallet alert) from a personal-wallet alert
// (the recipient's own balance was credited/debited).
const isAppWalletScopedNotification = (alert) => {
  const metadata = alert?.metadata || {};
  const explicitLink = normalizeNotificationLink(
    alert?.actionLink || alert?.deepLink || metadata?.deepLink || ''
  ).toLowerCase();
  if (explicitLink.startsWith('/admin')) return true;
  const role = String(metadata?.role || '').trim().toLowerCase();
  if (role === 'wallet_deposit_request' || role === 'wallet_withdrawal_request') return true;
  const scope = String(metadata?.walletScope || metadata?.scope || metadata?.walletType || '')
    .trim()
    .toLowerCase();
  return scope === 'app' || scope === 'platform' || scope === 'admin';
};

const buildWalletPath = (alert, user) => {
  if (!isWalletNotification(alert)) return '';
  // App/platform-wallet alerts route privileged recipients to the app wallet
  // (deposit/withdrawal verification) instead of their personal portefeuille.
  // Personal-wallet alerts — and everyone without app-wallet access — go to /wallet.
  if (isAppWalletScopedNotification(alert) && userCanManageAppWallet(user)) {
    const explicit = normalizeNotificationLink(
      alert?.actionLink || alert?.deepLink || alert?.metadata?.deepLink || ''
    );
    return explicit && explicit.toLowerCase().startsWith('/admin') ? explicit : APP_WALLET_PATH;
  }
  return '/wallet';
};

const buildOrderReviewPath = (alert) => {
  const metadata = alert?.metadata || {};
  const orderId =
    extractObjectId(metadata.orderId) ||
    extractObjectId(alert?.entityType === 'order' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId);
  if (!orderId) return '';
  const params = new URLSearchParams();
  const productId = extractObjectId(metadata.productId);
  if (productId) {
    params.set('productId', productId);
  }
  return `/orders/${encodeURIComponent(orderId)}/review${params.toString() ? `?${params.toString()}` : ''}`;
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

const buildComplaintPath = (alert, user) => {
  if (!COMPLAINT_TYPES.has(String(alert?.type || ''))) return '';
  const metadata = alert?.metadata || {};
  const complaintId =
    extractObjectId(metadata.complaintId) ||
    extractObjectId(alert?.entityType === 'complaint' ? alert?.entityId : '') ||
    extractObjectId(alert?.entityId);
  if (userIsBackoffice(user)) {
    return complaintId
      ? `/admin/complaints?complaintId=${encodeURIComponent(complaintId)}`
      : '/admin/complaints';
  }
  return complaintId
    ? `/reclamations?complaintId=${encodeURIComponent(complaintId)}`
    : '/reclamations';
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

const resolveRoleAwareOrderLink = (alert, user, deepLink = '') => {
  const orderIdFromLink = extractOrderIdFromLink(deepLink);
  const canonicalOrderPath = buildOrderPath(alert, user, orderIdFromLink);

  if (!deepLink) return canonicalOrderPath;
  if (!isOrderScopedLink(deepLink)) return deepLink;
  return canonicalOrderPath || deepLink;
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

const buildFeedbackPath = () => '/avis-amelioration';

const buildShopConversionPath = () => '/shop-conversion-request';

const isOrderLikeType = (type = '') => {
  const normalized = String(type || '').trim();
  return (
    ORDER_TYPES.has(normalized) ||
    INSTALLMENT_TYPES.has(normalized) ||
    normalized.startsWith('order_') ||
    normalized.startsWith('installment_')
  );
};

export const resolveNotificationLink = (alert, user = null) => {
  if (!alert) return '';
  const type = String(alert?.type || '').trim();
  const deepLink = normalizeNotificationLink(
    alert?.actionLink || alert?.deepLink || alert?.metadata?.deepLink || ''
  );
  const walletPath = buildWalletPath(alert, user);
  if (walletPath) return walletPath;

  if (type.startsWith('sponsorship_')) {
    return '/sponsorships';
  }

  if (type === 'order_message') {
    if (deepLink && deepLink.includes('/orders/messages')) return deepLink;
    return buildOrderPath(alert, user);
  }

  if (type === 'review_reminder') {
    return buildOrderReviewPath(alert) || resolveRoleAwareOrderLink(alert, user, deepLink) || buildOrderPath(alert, user);
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

  if (type === 'payment_pending') {
    return deepLink || buildOrderPath(alert, user) || '/orders';
  }

  if (type === 'validation_required') {
    return deepLink || '/admin/task-center';
  }

  if (DISPUTE_TYPES.has(type)) {
    return deepLink || buildDisputePath(alert, user);
  }

  if (COMPLAINT_TYPES.has(type)) {
    return deepLink || buildComplaintPath(alert, user);
  }

  if (DELIVERY_TYPES.has(type)) {
    return resolveRoleAwareOrderLink(alert, user, deepLink) || buildDeliveryPath(alert, user);
  }

  if (isOrderLikeType(type)) {
    return resolveRoleAwareOrderLink(alert, user, deepLink) || buildOrderPath(alert, user) || '/orders';
  }

  // Older and non-standard order notification types can still carry an
  // orderId (for example payment events). Never let their legacy
  // /orders/:id link fall through to the status-filter route.
  const hasOrderContext = Boolean(
    extractObjectId(alert?.metadata?.orderId) ||
    extractObjectId(alert?.entityType === 'order' ? alert?.entityId : '') ||
    extractOrderIdFromLink(deepLink)
  );
  if (hasOrderContext) {
    return resolveRoleAwareOrderLink(alert, user, deepLink) || buildOrderPath(alert, user);
  }

  if (FEEDBACK_TYPES.has(type)) {
    return deepLink || buildFeedbackPath();
  }

  if (SHOP_CONVERSION_TYPES.has(type)) {
    return deepLink || buildShopConversionPath();
  }

  if (type === 'shop_follow' || type === 'shop_boosted' || type === 'shop_verified') {
    const shopIdentifier = buildShopIdentifier(alert);
    return deepLink || (shopIdentifier ? buildShopPath(shopIdentifier) : '');
  }

  if (PRODUCT_TYPES.has(type)) {
    const productIdentifier = buildProductIdentifier(alert);
    return deepLink || (productIdentifier ? buildProductPath(productIdentifier) : '') || '/products';
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
