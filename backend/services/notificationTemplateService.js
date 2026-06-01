const formatAmount = (value, currency = 'FCFA') => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
};

const pickFirst = (...values) =>
  values.map((value) => String(value || '').trim()).find(Boolean) || '';

const resolveOrderLabel = (metadata = {}, snapshot = {}) => {
  const productTitle = pickFirst(
    snapshot.orderProductTitle,
    snapshot.productTitle,
    metadata.orderProductTitle,
    metadata.productTitle,
    metadata.primaryProductTitle,
    Array.isArray(metadata.productTitles) ? metadata.productTitles[0] : ''
  );
  return productTitle ? `la commande "${productTitle}"` : 'la commande';
};

const buildPaymentMessage = ({ metadata = {}, actorName = 'Un utilisateur', action = 'a soumis une preuve de paiement' }) => {
  const amount = formatAmount(metadata.amount || metadata.expectedAmount || metadata.amountPaid);
  const suffix = amount ? ` (${amount})` : '';
  return `${actorName} ${action}${suffix}.`;
};

const TEMPLATES = {
  order_placed: ({ metadata, snapshot, actorName }) => ({
    title: 'Commande passée',
    message: `${actorName} a passé ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Voir commande'
  }),
  order_created: ({ metadata, snapshot, actorName }) => ({
    title: 'Commande créée',
    message: `${actorName} a créé ${resolveOrderLabel(metadata, snapshot)}.`,
    actionLabel: 'Voir commande'
  }),
  order_accepted: ({ metadata, snapshot }) => ({
    title: 'Commande acceptée',
    message: `${resolveOrderLabel(metadata, snapshot)} a été acceptée. La préparation peut commencer.`,
    actionLabel: 'Voir commande'
  }),
  order_rejected: ({ metadata, snapshot }) => ({
    title: 'Commande rejetée',
    message: `${resolveOrderLabel(metadata, snapshot)} a été rejetée.${metadata.reason ? ` Raison: ${metadata.reason}` : ''}`,
    actionLabel: 'Voir commande'
  }),
  order_cancelled: ({ metadata, snapshot, actorName }) => ({
    title: 'Commande annulée',
    message: `${actorName} a annulé ${resolveOrderLabel(metadata, snapshot)}.${metadata.reason ? ` Raison: ${metadata.reason}` : ''}`,
    actionLabel: 'Voir commande'
  }),
  payment_pending: ({ metadata, actorName }) => ({
    title: 'Paiement en attente',
    message: buildPaymentMessage({ metadata, actorName }),
    actionLabel: 'Vérifier paiement'
  }),
  payment_proof_submitted: ({ metadata, actorName }) => ({
    title: 'Preuve de paiement reçue',
    message: buildPaymentMessage({ metadata, actorName }),
    actionLabel: 'Vérifier paiement'
  }),
  payment_validated: ({ metadata }) => {
    const amount = formatAmount(metadata.amount || metadata.amountPaid);
    return {
      title: 'Paiement validé',
      message: `Votre paiement${amount ? ` de ${amount}` : ''} a été validé. Vous pouvez suivre la suite depuis la commande.`,
      actionLabel: 'Voir commande'
    };
  },
  delivery_assigned: ({ metadata, snapshot }) => ({
    title: 'Livraison assignée',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} a été assignée${metadata.courierName ? ` à ${metadata.courierName}` : ''}.`,
    actionLabel: 'Voir livraison'
  }),
  delivery_in_progress: ({ metadata, snapshot }) => ({
    title: 'Livraison en cours',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} est en cours.`,
    actionLabel: 'Suivre livraison'
  }),
  delivery_completed: ({ metadata, snapshot }) => ({
    title: 'Livraison terminée',
    message: `La livraison de ${resolveOrderLabel(metadata, snapshot)} est terminée.`,
    actionLabel: 'Voir commande'
  }),
  delivery_distance_warning: ({ metadata, snapshot }) => ({
    title: 'Livraison longue distance',
    message: `Le vendeur de ${resolveOrderLabel(metadata, snapshot)} est dans une autre ville${metadata.buyerCity ? ` que ${metadata.buyerCity}` : ''}. Vérifiez les conditions de livraison, l'emballage et l'état du produit à la réception.`,
    actionLabel: 'Voir commande'
  }),
  review_reminder: ({ metadata, snapshot }) => ({
    title: 'Avis demandé',
    message: `Comment s'est passée ${resolveOrderLabel(metadata, snapshot)} ? Partagez votre expérience en laissant un avis.`,
    actionLabel: 'Laisser un avis'
  }),
  product_approved: ({ snapshot }) => ({
    title: 'Produit approuvé',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est visible pour les acheteurs.`,
    actionLabel: 'Voir produit'
  }),
  product_approval: ({ snapshot }) => ({
    title: 'Produit approuvé',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est visible pour les acheteurs.`,
    actionLabel: 'Voir produit'
  }),
  product_rejected: ({ snapshot, metadata }) => ({
    title: 'Produit rejeté',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a été rejetée.${metadata.reason ? ` Raison: ${metadata.reason}` : ''}`,
    actionLabel: 'Corriger'
  }),
  product_rejection: ({ snapshot, metadata }) => ({
    title: 'Produit rejeté',
    message: `Votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} a été rejetée.${metadata.reason ? ` Raison: ${metadata.reason}` : ''}`,
    actionLabel: 'Corriger'
  }),
  boost_expired: ({ snapshot }) => ({
    title: 'Boost expiré',
    message: `Le boost de votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est expiré.`,
    actionLabel: 'Renouveler'
  }),
  promo_expired: ({ snapshot }) => ({
    title: 'Promotion expirée',
    message: `La promotion de votre annonce${snapshot.productTitle ? ` "${snapshot.productTitle}"` : ''} est expirée.`,
    actionLabel: 'Voir produit'
  }),
  validation_required: ({ metadata }) => ({
    title: pickFirst(metadata.title, 'Action requise'),
    message: pickFirst(metadata.message, 'Une action de validation est requise.'),
    actionLabel: pickFirst(metadata.actionLabel, 'Ouvrir')
  })
};

export const buildNotificationSnapshot = ({
  actor = null,
  product = null,
  shop = null,
  metadata = {},
  snapshot = {}
} = {}) => ({
  actorName: pickFirst(snapshot.actorName, metadata.actorName, actor?.name, actor?.shopName),
  actorAvatar: pickFirst(snapshot.actorAvatar, metadata.actorAvatar, actor?.profileImage, actor?.shopLogo),
  productTitle: pickFirst(snapshot.productTitle, metadata.productTitle, metadata.orderProductTitle, product?.title),
  productSlug: pickFirst(snapshot.productSlug, metadata.productSlug, product?.slug),
  shopName: pickFirst(snapshot.shopName, metadata.shopName, shop?.shopName, shop?.name),
  shopSlug: pickFirst(snapshot.shopSlug, metadata.shopSlug, shop?.slug),
  orderCode: pickFirst(snapshot.orderCode, metadata.orderCode, metadata.orderNumber),
  orderProductTitle: pickFirst(
    snapshot.orderProductTitle,
    metadata.orderProductTitle,
    metadata.primaryProductTitle,
    Array.isArray(metadata.productTitles) ? metadata.productTitles[0] : ''
  )
});

export const buildNotificationDisplay = ({
  type,
  metadata = {},
  snapshot = {},
  title = '',
  message = '',
  actionLabel = ''
} = {}) => {
  const explicit = {
    title: pickFirst(title, metadata.title),
    message: pickFirst(message, metadata.message),
    actionLabel: pickFirst(actionLabel, metadata.actionLabel)
  };
  const actorName = snapshot.actorName || metadata.actorName || 'Un utilisateur';
  const template = TEMPLATES[String(type || '')];
  const generated = template ? template({ metadata, snapshot, actorName }) : {};
  return {
    title: pickFirst(explicit.title, generated.title, 'Notification'),
    message: pickFirst(explicit.message, generated.message, 'Vous avez une nouvelle notification.'),
    actionLabel: pickFirst(explicit.actionLabel, generated.actionLabel, 'Ouvrir')
  };
};

export const buildNotificationDedupeKey = ({
  userId,
  type,
  metadata = {},
  entityType = '',
  entityId = '',
  productId = '',
  shopId = '',
  dedupeKey = ''
} = {}) => {
  const explicit = pickFirst(dedupeKey, metadata.dedupeKey);
  if (explicit) return explicit.slice(0, 220);

  const resolvedEntityType = pickFirst(entityType, metadata.entityType);
  const resolvedEntityId = pickFirst(
    entityId,
    metadata.entityId,
    metadata.paymentId,
    metadata.orderId,
    metadata.deliveryRequestId,
    productId,
    shopId
  );
  const resolvedType = String(type || '').trim();
  const resolvedUser = String(userId || '').trim();
  if (!resolvedUser || !resolvedType || !resolvedEntityId) return '';

  return [resolvedUser, resolvedType, resolvedEntityType || 'entity', resolvedEntityId]
    .join(':')
    .slice(0, 220);
};
