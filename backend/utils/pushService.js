import admin from 'firebase-admin';
import PushToken from '../models/pushTokenModel.js';
import User from '../models/userModel.js';

let firebaseApp;
let pushNotConfiguredWarned = false;

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const URL_BASE = 'https://hdmarket.local';

const extractObjectId = (value, depth = 0) => {
  if (depth > 3 || value == null) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return OBJECT_ID_REGEX.test(trimmed) ? trimmed : '';
  }

  if (typeof value === 'object') {
    const candidates = [value._id, value.id, value.$oid, value.orderId, value.value];
    for (const candidate of candidates) {
      const resolved = extractObjectId(candidate, depth + 1);
      if (resolved) return resolved;
    }
  }

  return '';
};

const normalizeNotificationUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('[object Object]')) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
};

const isBackofficeUser = (user = {}) => {
  const role = String(user?.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'founder' || role === 'manager';
};

const isSellerUser = (user = {}) => {
  const role = String(user?.role || '').trim().toLowerCase();
  const accountType = String(user?.accountType || '').trim().toLowerCase();
  return role === 'seller' || accountType === 'shop';
};

const isCourierUser = (user = {}) => {
  const role = String(user?.role || '').trim().toLowerCase();
  return role === 'delivery_agent' || role === 'courier';
};

const buildOrderDetailsUrl = ({ orderId, recipientUser }) => {
  if (!orderId) return '';
  if (isBackofficeUser(recipientUser)) {
    return `/admin/orders?orderId=${encodeURIComponent(orderId)}`;
  }
  if (isSellerUser(recipientUser)) {
    return `/seller/orders/detail/${encodeURIComponent(orderId)}`;
  }
  return `/orders/detail/${encodeURIComponent(orderId)}`;
};

const isGenericOrdersCollectionUrl = (value = '') => {
  const normalized = normalizeNotificationUrl(value);
  if (!normalized) return false;
  return (
    /^\/orders(?:\/(?:pending|pending_installment|installment_active|overdue_installment|confirmed|delivering|delivered|completed|cancelled))?(?:\?.*)?$/i.test(normalized) ||
    /^\/seller\/orders(?:\?.*)?$/i.test(normalized) ||
    /^\/admin\/orders(?:\?.*)?$/i.test(normalized)
  );
};

const appendQueryAndHash = (link, params = {}, hash = '') => {
  const normalized = normalizeNotificationUrl(link);
  if (!normalized) return '';
  try {
    const isAbsolute = ABSOLUTE_URL_REGEX.test(normalized);
    const url = new URL(normalized, URL_BASE);
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    if (hash) {
      url.hash = hash.startsWith('#') ? hash : `#${hash}`;
    }
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return normalized;
  }
};

const buildProductReviewsUrl = ({ notification, productId }) => {
  const metadata = notification?.metadata || {};
  const deepLink = normalizeNotificationUrl(
    notification?.deepLink || notification?.actionLink || metadata.deepLink || ''
  );
  const productSlug = String(
    metadata.productSlug || notification?.product?.slug || notification?.product?.id || ''
  ).trim();
  const baseProductPath = productSlug || productId ? `/product/${encodeURIComponent(productSlug || String(productId))}` : '';
  const base =
    deepLink && deepLink.includes('/product/')
      ? deepLink
      : baseProductPath;
  if (!base) return '';
  const commentId =
    extractObjectId(metadata.commentId) ||
    extractObjectId(metadata.parentId) ||
    extractObjectId(metadata.replyId);
  return appendQueryAndHash(
    base,
    {
      tab: 'reviews',
      open: 'comments',
      ...(commentId ? { commentId } : {})
    },
    'comments'
  );
};

const buildShopReviewsUrl = ({ notification, shopId }) => {
  const metadata = notification?.metadata || {};
  const deepLink = normalizeNotificationUrl(
    notification?.deepLink || notification?.actionLink || metadata.deepLink || ''
  );
  const shopSlug = String(metadata.shopSlug || notification?.shop?.slug || '').trim();
  const baseShopPath = shopSlug || shopId ? `/shop/${encodeURIComponent(shopSlug || String(shopId))}` : '';
  const base =
    deepLink && deepLink.includes('/shop/')
      ? deepLink
      : baseShopPath;
  if (!base) return '';
  const reviewId = extractObjectId(metadata.reviewId);
  return appendQueryAndHash(base, reviewId ? { reviewId } : {}, 'reviews');
};

const resolveNotificationClickUrl = ({ notification, orderId, productId, shopId, recipientUser = null }) => {
  const metadata = notification?.metadata || {};
  const notificationType = String(notification?.type || '').trim();
  let url = normalizeNotificationUrl(
    notification?.deepLink || notification?.actionLink || metadata.deepLink || ''
  );

  if (notificationType === 'order_message') {
    const fallbackOrderMessageUrl = orderId
      ? `/orders/messages?orderId=${encodeURIComponent(orderId)}`
      : '/orders/messages';
    const hasLegacyOrderDetailPath =
      url.includes('/orders/detail/') ||
      url.includes('/seller/orders/detail/') ||
      url.includes('/admin/orders?orderId=');
    if (!url || hasLegacyOrderDetailPath) {
      url = fallbackOrderMessageUrl;
    }
    return url;
  }

  if (notificationType === 'product_comment' || notificationType === 'reply' || notificationType === 'rating' || notificationType === 'review_reminder') {
    return buildProductReviewsUrl({ notification, productId }) || url || '/products';
  }

  if (notificationType === 'shop_review') {
    return buildShopReviewsUrl({ notification, shopId }) || url || '/shops/verified';
  }

  if (!url && notificationType === 'payment_pending') {
    if (isBackofficeUser(recipientUser)) {
      return '/admin/payment-verification?status=waiting';
    }
    return buildOrderDetailsUrl({ orderId, recipientUser }) || '/orders';
  }

  if (!url && notificationType.startsWith('dispute_')) {
    const disputeId =
      extractObjectId(metadata.disputeId) ||
      extractObjectId(notification?.entityType === 'dispute' ? notification?.entityId : '');
    if (isBackofficeUser(recipientUser)) {
      return disputeId ? `/admin/complaints?disputeId=${encodeURIComponent(disputeId)}` : '/admin/complaints';
    }
    if (isSellerUser(recipientUser)) {
      return disputeId ? `/seller/disputes?disputeId=${encodeURIComponent(disputeId)}` : '/seller/disputes';
    }
    return disputeId ? `/reclamations?disputeId=${encodeURIComponent(disputeId)}` : '/reclamations';
  }

  if (!url && notificationType.startsWith('complaint_')) {
    if (isBackofficeUser(recipientUser)) return '/admin/complaints';
    return '/reclamations';
  }

  if (!url && (
    notificationType.startsWith('delivery_request_') ||
    notificationType === 'order_delivering' ||
    notificationType === 'order_delivered'
  )) {
    const deliveryRequestId =
      extractObjectId(metadata.requestId) ||
      extractObjectId(metadata.deliveryRequestId) ||
      extractObjectId(notification?.entityType === 'deliveryRequest' ? notification?.entityId : '');

    if (isBackofficeUser(recipientUser)) {
      return deliveryRequestId
        ? `/admin/delivery-requests?requestId=${encodeURIComponent(deliveryRequestId)}`
        : '/admin/delivery-requests';
    }
    if (isCourierUser(recipientUser)) {
      return deliveryRequestId
        ? `/delivery/assignment/${encodeURIComponent(deliveryRequestId)}`
        : '/delivery/dashboard';
    }
    return buildOrderDetailsUrl({ orderId, recipientUser }) || '/orders';
  }

  if (
    (notificationType.startsWith('order_') || notificationType.startsWith('installment_')) &&
    orderId &&
    (!url || isGenericOrdersCollectionUrl(url))
  ) {
    return buildOrderDetailsUrl({ orderId, recipientUser });
  }

  if (!url && (notificationType.startsWith('order_') || notificationType.startsWith('installment_'))) {
    const status = String(metadata.status || '').trim();
    if (
      status &&
      [
        'pending',
        'pending_installment',
        'installment_active',
        'overdue_installment',
        'confirmed',
        'delivering',
        'delivered',
        'completed',
        'cancelled'
      ].includes(status)
    ) {
      return `/orders/${status}`;
    }
    return buildOrderDetailsUrl({ orderId, recipientUser }) || '/orders';
  }

  if (!url && productId) {
    return `/product/${notification?.product?.slug || productId}`;
  }
  if (!url && shopId) {
    return `/shop/${notification?.shop?.slug || shopId}`;
  }
  return url;
};

const parseServiceAccount = () => {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) return null;
  try {
    if (raw.trim().startsWith('{')) {
      return JSON.parse(raw);
    }
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) return null;
  if (admin.apps?.length) {
    firebaseApp = admin.app();
    return firebaseApp;
  }
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  return firebaseApp;
};

export const isPushConfigured = () => Boolean(getFirebaseApp());

const loadPushRecipient = async (userId) =>
  User.findById(userId)
    .select('role accountType notificationPreferences')
    .lean();

const shouldSendForPreference = (user, type) => {
  if (!user) return false;
  if (!type) return true;
  const prefs = user.notificationPreferences || {};
  if (typeof prefs[type] === 'boolean') {
    return prefs[type];
  }
  return true;
};

const buildPushPayload = ({ notification, actorName, productTitle, shopName }) => {
  const metadata = notification?.metadata || {};
  const safeProductTitle = productTitle || metadata.productTitle || '';
  const safeShopName = shopName || metadata.shopName || '';
  const productLabel = safeProductTitle ? ` "${safeProductTitle}"` : '';
  const shopLabel = safeShopName ? ` "${safeShopName}"` : '';
  const rawSnippet =
    typeof metadata.messagePreview === 'string'
      ? metadata.messagePreview
      : typeof metadata.message === 'string'
      ? metadata.message
      : typeof metadata.comment === 'string'
      ? metadata.comment
      : '';
  const snippet =
    rawSnippet.length > 120
      ? `${rawSnippet.slice(0, 117)}...`
      : rawSnippet;
  const orderProductTitle = [
    metadata.orderProductTitle,
    metadata.productTitle,
    metadata.primaryProductTitle,
    Array.isArray(metadata.productTitles) ? metadata.productTitles[0] : ''
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean);
  const orderSubject = orderProductTitle ? `la commande "${orderProductTitle}"` : 'la commande';
  const yourOrderSubject = orderProductTitle
    ? `votre commande "${orderProductTitle}"`
    : 'votre commande';

  let title = 'HDMarket';
  let body = 'Vous avez une nouvelle notification.';

  switch (notification?.type) {
    case 'product_comment': {
      title = 'Nouveau commentaire';
      body = snippet
        ? `${actorName} a commenté votre annonce${productLabel} : ${snippet}`
        : `${actorName} a commenté votre annonce${productLabel}.`;
      break;
    }
    case 'reply': {
      title = 'Nouvelle réponse';
      body = snippet
        ? `${actorName} a répondu à votre commentaire${productLabel} : ${snippet}`
        : `${actorName} a répondu à votre commentaire${productLabel}.`;
      break;
    }
    case 'favorite': {
      title = 'Nouveau favori';
      body = `${actorName} a ajouté votre annonce${productLabel} à ses favoris.`;
      break;
    }
    case 'rating': {
      const ratingValue = Number(metadata.value || 0);
      const ratingText =
        Number.isFinite(ratingValue) && ratingValue > 0 ? ` (${ratingValue}/5)` : '';
      title = 'Nouvelle note';
      body = `${actorName} a noté votre annonce${productLabel}${ratingText}.`;
      break;
    }
    case 'product_approval': {
      title = 'Annonce approuvée';
      body = `${actorName} a approuvé votre annonce${productLabel}.`;
      break;
    }
    case 'product_rejection': {
      title = 'Annonce rejetée';
      body = `${actorName} a rejeté votre annonce${productLabel}.`;
      break;
    }
    case 'product_certified': {
      title = 'Annonce certifiée';
      body = `${actorName} a certifié votre annonce${productLabel}.`;
      break;
    }
    case 'product_boosted': {
      title = 'Annonce boostée';
      body = `${actorName} a boosté votre annonce${productLabel}. Elle sera maintenant mise en avant.`;
      break;
    }
    case 'promotional': {
      const discountValue = Number(metadata.discount ?? 0);
      const hasDiscount = Number.isFinite(discountValue) && discountValue > 0;
      title = 'Promotion activée';
      body = hasDiscount
        ? `${actorName} a appliqué une remise de ${discountValue}% sur votre annonce${productLabel}.`
        : `${actorName} a mis en avant votre annonce${productLabel}.`;
      break;
    }
    case 'shop_review': {
      const ratingValue = Number(metadata.rating || 0);
      const ratingText =
        Number.isFinite(ratingValue) && ratingValue > 0 ? ` (${ratingValue}/5)` : '';
      title = 'Nouvel avis boutique';
      body = snippet
        ? `${actorName} a laissé un avis sur votre boutique${shopLabel}${ratingText} : ${snippet}`
        : `${actorName} a laissé un avis sur votre boutique${shopLabel}${ratingText}.`;
      break;
    }
    case 'shop_follow': {
      title = 'Nouvel abonné';
      body = `${actorName} suit votre boutique${shopLabel}.`;
      break;
    }
    case 'shop_verified': {
      title = 'Boutique vérifiée';
      body = `${actorName} a vérifié votre boutique${shopLabel}.`;
      break;
    }
    case 'shop_boosted': {
      title = 'Boutique boostée';
      body = `${actorName} a boosté votre boutique${shopLabel}. Elle sera maintenant mise en avant.`;
      break;
    }
    case 'payment_pending': {
      const amountValue = Number(metadata.amount || 0);
      const amountText =
        Number.isFinite(amountValue) && amountValue > 0
          ? ` (${amountValue.toLocaleString('fr-FR')} FCFA)`
          : '';
      const waitingCount = Number(metadata.waitingCount || 0);
      const waitingSuffix =
        waitingCount > 1 ? ` · ${waitingCount} paiements en attente` : '';
      title = 'Paiement en attente';
      body = `${actorName} a soumis une preuve de paiement${productLabel}${amountText}.${waitingSuffix}`;
      break;
    }
    case 'order_created': {
      const status = metadata.status;
      if (status === 'confirmed') {
        title = 'Commande confirmée';
        body = `${yourOrderSubject} est confirmée.`;
      } else if (status === 'pending') {
        title = 'Commande en attente';
        body = `${yourOrderSubject} est en attente de validation.`;
      } else {
        title = 'Nouvelle commande';
        body = `${yourOrderSubject} est enregistrée.`;
      }
      break;
    }
    case 'order_received': {
      const itemCount = Number(metadata.itemCount || 0);
      const itemsLabel =
        itemCount > 1 ? `${itemCount} articles` : itemCount === 1 ? '1 article' : 'des articles';
      const totalValue = Number(metadata.totalAmount || 0);
      const totalText =
        Number.isFinite(totalValue) && totalValue > 0
          ? ` (${totalValue.toLocaleString('fr-FR')} FCFA)`
          : '';
      title = 'Nouvelle commande';
      body = `${actorName} a passé ${orderSubject} pour ${itemsLabel}${totalText}.`;
      break;
    }
    case 'order_full_payment_waived': {
      title = 'Paiement intégral confirmé';
      body = 'Votre commande est entièrement payée. Les frais de livraison sont offerts.';
      break;
    }
    case 'order_full_payment_received': {
      title = 'Commande réglée intégralement';
      body = `${actorName} a payé ${orderSubject} en totalité. Frais de livraison verrouillés.`;
      break;
    }
    case 'order_full_payment_ready': {
      title = 'Commande prête';
      body = `${orderSubject} a été payée intégralement. Livraison offerte activée.`;
      break;
    }
    case 'order_reminder': {
      const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
      title = 'Rappel de commande';
      body = `${actorName} vous rappelle d'accélérer ${orderSubject}${city}.`;
      break;
    }
    case 'order_cancellation_window_skipped': {
      title = metadata?.title || 'Délai d’annulation levé';
      body = metadata?.message || `Le client a autorisé le traitement immédiat de ${orderSubject}.`;
      break;
    }
    case 'order_delivering': {
      const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
      title = 'Commande en livraison';
      body = `${yourOrderSubject} est en cours de livraison${city}.`;
      break;
    }
    case 'order_delivered': {
      if (metadata.deliveryProofSubmitted) {
        title = 'Preuve de livraison reçue';
        body = `Le vendeur a soumis la preuve pour ${orderSubject}. Confirmez la livraison.`;
      } else {
        title = 'Commande livrée';
        body = `${yourOrderSubject} a été livrée.`;
      }
      break;
    }
    case 'installment_due_reminder': {
      title = 'Rappel échéance';
      body = `Votre prochaine tranche pour ${yourOrderSubject} arrive à échéance dans 3 jours.`;
      break;
    }
    case 'installment_overdue_warning': {
      title = 'Paiement en retard';
      body = `${yourOrderSubject} contient une tranche en retard. Merci de régulariser rapidement.`;
      break;
    }
    case 'installment_payment_submitted': {
      const amountValue = Number(metadata.amount || 0);
      const amountText =
        Number.isFinite(amountValue) && amountValue > 0
          ? ` (${amountValue.toLocaleString('fr-FR')} FCFA)`
          : '';
      title = 'Preuve de tranche reçue';
      body = `${actorName} a soumis une preuve de paiement${amountText} pour ${orderSubject}.`;
      break;
    }
    case 'installment_payment_validated': {
      title = 'Tranche validée';
      body = `${actorName} a validé votre paiement de tranche pour ${yourOrderSubject}.`;
      break;
    }
    case 'installment_sale_confirmation_required': {
      title = 'Confirmation de vente requise';
      body = `${actorName} a lancé un paiement en tranche pour ${orderSubject}. Vérifiez la preuve de vente.`;
      break;
    }
    case 'installment_sale_confirmed': {
      title = 'Vente confirmée';
      body = `${yourOrderSubject} en tranche est confirmée. L’échéancier est actif.`;
      break;
    }
    case 'installment_completed': {
      title = 'Paiement terminé';
      body = `Toutes les tranches de ${yourOrderSubject} sont réglées.`;
      break;
    }
    case 'installment_product_suspended': {
      title = 'Tranches suspendues';
      body = metadata.message || 'Le paiement par tranche du produit a été suspendu.';
      break;
    }
    case 'review_reminder': {
      const productCount = metadata.productCount || 1;
      const productText = productCount === 1 ? 'produit' : 'produits';
      title = 'Donnez votre avis';
      body = `${yourOrderSubject} a été livrée. Partagez votre expérience en notant ${productCount > 1 ? `vos ${productCount} ${productText}` : 'votre produit'} !`;
      break;
    }
    case 'order_address_updated': {
      title = 'Adresse modifiée';
      body = `L'adresse de livraison de ${orderSubject} a été modifiée.`;
      break;
    }
    case 'order_delivery_fee_updated': {
      const actorLabel = actorName && actorName !== 'Quelqu’un' ? actorName : 'HDMarket';
      title = 'Frais de livraison modifiés';
      body = `${actorLabel} a mis a jour les frais de livraison de ${yourOrderSubject}. Verifiez le detail de la commande.`;
      break;
    }
    case 'order_message': {
      title = 'Nouveau message';
      body = snippet
        ? `${actorName} - ${orderSubject}: ${snippet}`
        : `${actorName} vous a envoye un message concernant ${orderSubject}.`;
      break;
    }
    case 'order_cancelled': {
      const reason = metadata.reason ? ` Raison: ${metadata.reason}` : '';
      const refundAmount = Number(metadata.refundAmount || 0);
      const refundText = metadata.refundRequested
        ? refundAmount > 0
          ? ` Remboursement demandé: ${refundAmount.toLocaleString('fr-FR')} FCFA.`
          : ' Remboursement demandé.'
        : '';
      title = 'Commande annulée';
      body = `${yourOrderSubject} a été annulée par le vendeur.${reason}${refundText}`;
      break;
    }
    case 'complaint_resolved': {
      const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
      title = 'Réclamation résolue';
      body = `${actorName} a marqué votre réclamation${subjectLabel} comme résolue.`;
      break;
    }
    case 'complaint_created': {
      const subjectLabel = metadata.subject ? ` : ${metadata.subject}` : '';
      title = 'Nouvelle réclamation';
      body = `${actorName} a déposé une réclamation${subjectLabel}`;
      break;
    }
    case 'dispute_created': {
      title = 'Nouveau litige';
      body = `${actorName} a ouvert un litige pour ${orderSubject}.`;
      break;
    }
    case 'dispute_seller_responded': {
      title = 'Réponse du vendeur';
      body = `${actorName} a répondu au litige de ${orderSubject}.`;
      break;
    }
    case 'dispute_deadline_near': {
      title = 'Rappel litige';
      body = `Répondez au litige de ${orderSubject} avant l’échéance.`;
      break;
    }
    case 'dispute_under_review': {
      title = 'Litige en revue';
      body = `Le litige de ${orderSubject} est en cours d’arbitrage admin.`;
      break;
    }
    case 'dispute_resolved': {
      title = 'Litige résolu';
      body = `${actorName} a clôturé le litige de ${orderSubject}.`;
      break;
    }
    case 'feedback_read': {
      const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
      title = 'Avis lu';
      body = `${actorName} a lu votre avis d’amélioration${subjectLabel}.`;
      break;
    }
    case 'improvement_feedback_created': {
      const subjectLabel = metadata.subject ? ` : ${metadata.subject}` : '';
      title = "Nouvel avis d'amélioration";
      body = `${actorName} a déposé un avis d'amélioration${subjectLabel}`;
      break;
    }
    case 'admin_broadcast': {
      title = metadata.title && String(metadata.title).trim() ? String(metadata.title).trim() : 'HDMarketCG';
      body = metadata.message && String(metadata.message).trim() ? String(metadata.message).trim() : 'Nouvelle notification.';
      break;
    }
    case 'account_restriction': {
      const restrictionLabel = metadata.restrictionLabel || 'restriction';
      title = 'Restriction de compte';
      body = metadata.message && String(metadata.message).trim()
        ? String(metadata.message).trim()
        : `${actorName} a appliqué une restriction "${restrictionLabel}".`;
      break;
    }
    case 'account_restriction_lifted': {
      const restrictionLabel = metadata.restrictionLabel || 'restriction';
      title = 'Restriction levée';
      body = metadata.message && String(metadata.message).trim()
        ? String(metadata.message).trim()
        : `${actorName} a levé la restriction "${restrictionLabel}".`;
      break;
    }
    case 'shop_conversion_request': {
      const shopNameLabel = metadata.shopName ? ` "${metadata.shopName}"` : '';
      title = 'Nouvelle demande de conversion';
      body = `${actorName} a soumis une demande de conversion en boutique${shopNameLabel}.`;
      break;
    }
    case 'shop_conversion_approved': {
      const shopNameLabel = metadata.shopName ? ` "${metadata.shopName}"` : '';
      title = 'Demande de boutique acceptée';
      body = `Votre demande de conversion en boutique${shopNameLabel} a été acceptée. Vous êtes maintenant une boutique sur HDMarket.`;
      break;
    }
    case 'shop_conversion_rejected': {
      title = 'Demande de boutique refusée';
      body = metadata.rejectionReason
        ? `Votre demande de conversion en boutique n'a pas été acceptée. Motif : ${metadata.rejectionReason}`
        : `Votre demande de conversion en boutique n'a pas été acceptée. Contactez le support pour plus d'informations.`;
      break;
    }
    case 'validation_required': {
      title =
        metadata.title && String(metadata.title).trim()
          ? String(metadata.title).trim()
          : 'Action de validation requise';
      body =
        metadata.message && String(metadata.message).trim()
          ? String(metadata.message).trim()
          : 'Une action de validation est en attente dans HDMarket.';
      break;
    }
    default:
      title = 'Nouvelle notification';
      body = `${actorName} a interagi avec votre compte.`;
  }

  return { title, body };
};

export const sendPushNotification = async ({
  notification,
  actorName,
  productTitle,
  shopName
}) => {
  if (!notification?.user) return null;
  if (!isPushConfigured()) {
    if (!pushNotConfiguredWarned) {
      pushNotConfiguredWarned = true;
      // eslint-disable-next-line no-console
      console.warn(
        'HDMarket push: FIREBASE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT_JSON/B64) is not set. Push notifications are disabled.'
      );
    }
    return null;
  }

  const recipientUser = await loadPushRecipient(notification.user);
  const shouldSend = shouldSendForPreference(recipientUser, notification.type);
  if (!shouldSend) return null;

  const tokenFilter = { user: notification.user, isActive: { $ne: false } };
  const tokens = await PushToken.find(tokenFilter).select('_id token platform failureCount').lean();
  if (!tokens.length) return null;

  const { title, body } = buildPushPayload({ notification, actorName, productTitle, shopName });
  const productId =
    extractObjectId(notification.product?._id) ||
    extractObjectId(notification.product) ||
    extractObjectId(notification.metadata?.productId) ||
    '';
  const shopId =
    extractObjectId(notification.shop?._id) ||
    extractObjectId(notification.shop) ||
    extractObjectId(notification.metadata?.shopId) ||
    '';
  const orderId =
    extractObjectId(notification.metadata?.orderId) ||
    extractObjectId(notification?.entityType === 'order' ? notification?.entityId : '') ||
    '';
  
  const url = resolveNotificationClickUrl({
    notification,
    orderId,
    productId,
    shopId,
    recipientUser
  });

  const metadata = notification?.metadata || {};
  const commentId =
    extractObjectId(metadata.commentId) ||
    extractObjectId(metadata.parentId) ||
    extractObjectId(metadata.replyId);
  const reviewId = extractObjectId(metadata.reviewId);
  const disputeId =
    extractObjectId(metadata.disputeId) ||
    extractObjectId(notification?.entityType === 'dispute' ? notification?.entityId : '');
  const deliveryRequestId =
    extractObjectId(metadata.requestId) ||
    extractObjectId(metadata.deliveryRequestId) ||
    extractObjectId(notification?.entityType === 'deliveryRequest' ? notification?.entityId : '');
  
  // FCM data payload: all values must be strings
  const data = {
    type: notification.type || 'notification',
    notificationId: String(notification._id || ''),
    orderId,
    productId: productId ? String(productId) : '',
    shopId: shopId ? String(shopId) : '',
    productSlug: String(notification?.product?.slug || metadata.productSlug || ''),
    shopSlug: String(notification?.shop?.slug || metadata.shopSlug || ''),
    entityType: String(notification?.entityType || ''),
    entityId: String(notification?.entityId || ''),
    recipientRole: String(recipientUser?.role || ''),
    recipientAccountType: String(recipientUser?.accountType || ''),
    commentId: commentId ? String(commentId) : '',
    reviewId: reviewId ? String(reviewId) : '',
    disputeId: disputeId ? String(disputeId) : '',
    deliveryRequestId: deliveryRequestId ? String(deliveryRequestId) : '',
    deepLink: String(notification?.deepLink || metadata.deepLink || ''),
    actionLink: String(notification?.actionLink || notification?.deepLink || metadata.deepLink || ''),
    ...(url ? { url } : {})
  };

  const payload = {
    tokens: tokens.map((item) => item.token),
    notification: { title, body },
    data,
    // Android: high priority so notification is delivered immediately (including in background/Doze)
    android: {
      priority: 'high',
      notification: { title, body, sound: 'default' }
    },
    // iOS: ensure notification is shown when app is in background and sound plays
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          contentAvailable: 1
        }
      },
    }
  };

  const response = await admin.messaging().sendEachForMulticast(payload);
  const invalidTokens = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const code = res.error?.code || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[idx]?.token);
      }
    }
  });
  if (invalidTokens.length) {
    await PushToken.updateMany(
      { token: { $in: invalidTokens } },
      {
        $set: {
          isActive: false,
          disabledReason: 'invalid_registration_token',
          lastFailureAt: new Date(),
          lastFailureCode: 'invalid_registration_token'
        },
        $inc: { failureCount: 1 }
      }
    );
  }

  const failedTokenIds = [];
  response.responses.forEach((res, idx) => {
    if (!res.success && tokens[idx]?._id) failedTokenIds.push(tokens[idx]._id);
  });
  if (failedTokenIds.length) {
    await PushToken.updateMany(
      { _id: { $in: failedTokenIds } },
      {
        $set: { lastFailureAt: new Date() },
        $inc: { failureCount: 1 }
      }
    );
  }
  const succeededTokenIds = [];
  response.responses.forEach((res, idx) => {
    if (res.success && tokens[idx]?._id) succeededTokenIds.push(tokens[idx]._id);
  });
  if (succeededTokenIds.length) {
    await PushToken.updateMany(
      { _id: { $in: succeededTokenIds } },
      {
        $set: {
          isActive: true,
          lastDeliveredAt: new Date(),
          lastSeenAt: new Date(),
          lastFailureAt: null,
          lastFailureCode: ''
        }
      }
    );
  }

  return response;
};
