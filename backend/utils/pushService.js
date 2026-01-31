import admin from 'firebase-admin';
import PushToken from '../models/pushTokenModel.js';
import User from '../models/userModel.js';

let firebaseApp;

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

const shouldSendForPreference = async (userId, type) => {
  if (!type) return true;
  const user = await User.findById(userId).select('notificationPreferences').lean();
  if (!user) return false;
  const prefs = user.notificationPreferences || {};
  if (typeof prefs[type] === 'boolean') {
    return prefs[type];
  }
  return true;
};

const buildPushPayload = ({ notification, actorName, productTitle, shopName }) => {
  const metadata = notification?.metadata || {};
  const orderId = metadata.orderId ? `#${String(metadata.orderId).slice(-6)}` : '';
  const safeProductTitle = productTitle || metadata.productTitle || '';
  const safeShopName = shopName || metadata.shopName || '';
  const productLabel = safeProductTitle ? ` "${safeProductTitle}"` : '';
  const shopLabel = safeShopName ? ` "${safeShopName}"` : '';
  const rawSnippet =
    typeof metadata.message === 'string'
      ? metadata.message
      : typeof metadata.comment === 'string'
      ? metadata.comment
      : '';
  const snippet =
    rawSnippet.length > 120
      ? `${rawSnippet.slice(0, 117)}...`
      : rawSnippet;

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
        body = `Votre commande ${orderId} est confirmée.`;
      } else if (status === 'pending') {
        title = 'Commande en attente';
        body = `Votre commande ${orderId} est en attente de validation.`;
      } else {
        title = 'Nouvelle commande';
        body = `Votre commande ${orderId} est enregistrée.`;
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
      body = `${actorName} a passé une commande ${orderId} pour ${itemsLabel}${totalText}.`;
      break;
    }
    case 'order_reminder': {
      const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
      title = 'Rappel de commande';
      body = `${actorName} vous rappelle d'accélérer la commande ${orderId}${city}.`;
      break;
    }
    case 'order_delivering': {
      const city = metadata.deliveryCity ? ` pour ${metadata.deliveryCity}` : '';
      title = 'Commande en livraison';
      body = `Votre commande ${orderId} est en cours de livraison${city}.`;
      break;
    }
    case 'order_delivered': {
      title = 'Commande livrée';
      body = `Votre commande ${orderId} a été livrée.`;
      break;
    }
    case 'review_reminder': {
      const productCount = metadata.productCount || 1;
      const productText = productCount === 1 ? 'produit' : 'produits';
      title = 'Donnez votre avis';
      body = `Votre commande ${orderId} a été livrée. Partagez votre expérience en notant ${productCount > 1 ? `vos ${productCount} ${productText}` : 'votre produit'} !`;
      break;
    }
    case 'order_address_updated': {
      title = 'Adresse modifiée';
      body = `L'adresse de livraison de la commande ${orderId} a été modifiée.`;
      break;
    }
    case 'order_message': {
      title = 'Nouveau message';
      body = `${actorName} vous a envoyé un message concernant la commande ${orderId}.`;
      break;
    }
    case 'order_cancelled': {
      const reason = metadata.reason ? ` Raison: ${metadata.reason}` : '';
      title = 'Commande annulée';
      body = `Votre commande ${orderId} a été annulée par le vendeur.${reason}`;
      break;
    }
    case 'complaint_resolved': {
      const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
      title = 'Réclamation résolue';
      body = `${actorName} a marqué votre réclamation${subjectLabel} comme résolue.`;
      break;
    }
    case 'feedback_read': {
      const subjectLabel = metadata.subject ? ` (${metadata.subject})` : '';
      title = 'Avis lu';
      body = `${actorName} a lu votre avis d’amélioration${subjectLabel}.`;
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
  if (!isPushConfigured()) return null;

  const shouldSend = await shouldSendForPreference(notification.user, notification.type);
  if (!shouldSend) return null;

  // For order messages, only send push to mobile devices (ios/android)
  const tokenFilter = { user: notification.user };
  if (notification.type === 'order_message') {
    tokenFilter.platform = { $in: ['ios', 'android'] };
  }
  const tokens = await PushToken.find(tokenFilter).select('token platform').lean();
  if (!tokens.length) return null;

  const { title, body } = buildPushPayload({ notification, actorName, productTitle, shopName });
  const productId = notification.product?._id || notification.product || '';
  const shopId = notification.shop?._id || notification.shop || '';
  const orderId = notification.metadata?.orderId ? String(notification.metadata.orderId) : '';
  
  // Build deeplink URL based on notification type
  let url = '';
  const notificationType = notification.type || '';
  if (notificationType === 'order_message') {
    url = '/orders/messages';
  } else if (notificationType.startsWith('order_')) {
    const status = notification.metadata?.status || '';
    if (status && ['pending', 'confirmed', 'delivering', 'delivered', 'cancelled'].includes(status)) {
      url = `/orders/${status}`;
    } else {
      url = '/orders';
    }
  } else if (productId) {
    url = `/product/${notification.product?.slug || productId}`;
  } else if (shopId) {
    url = `/shop/${notification.shop?.slug || shopId}`;
  }
  
  const payload = {
    tokens: tokens.map((item) => item.token),
    notification: { title, body },
    data: {
      type: notification.type || 'notification',
      notificationId: String(notification._id || ''),
      orderId,
      productId: productId ? String(productId) : '',
      shopId: shopId ? String(shopId) : '',
      ...(url ? { url } : {})
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
    await PushToken.deleteMany({ token: { $in: invalidTokens } });
  }

  return response;
};
