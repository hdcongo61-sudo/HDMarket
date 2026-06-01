import { createNotification } from './notificationService.js';

const normalizeCityName = (value = '') =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getOrderSellerCities = (order = {}) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return Array.from(
    new Set(
      items
        .map((item) => String(item?.snapshot?.shopCity || '').trim())
        .filter(Boolean)
    )
  );
};

export const buildDeliveryDistanceWarningPayload = ({ order, buyerId, actorId, productId = null } = {}) => {
  const deliveryMode = String(order?.deliveryMode || '').trim().toUpperCase();
  if (deliveryMode && deliveryMode !== 'DELIVERY') return null;
  if (String(order?.deliveryAddress || '').trim().toLowerCase() === 'retrait en boutique') return null;

  const buyerCity = String(order?.deliveryCity || '').trim();
  const sellerCities = getOrderSellerCities(order);
  const buyerCityKey = normalizeCityName(buyerCity);
  const remoteSellerCities = sellerCities.filter((city) => normalizeCityName(city) !== buyerCityKey);

  if (!order?._id || !buyerId || !actorId || !buyerCityKey || !remoteSellerCities.length) {
    return null;
  }

  return {
    userId: buyerId,
    actorId,
    productId,
    type: 'delivery_distance_warning',
    priority: 'HIGH',
    metadata: {
      orderId: order._id,
      buyerCity,
      sellerCities: remoteSellerCities,
      deliveryCity: buyerCity,
      deliveryAddress: order.deliveryAddress || '',
      risk: 'intercity_delivery',
      message:
        'Le vendeur est dans une autre ville. Vérifiez bien les conditions de livraison, l’emballage et les risques de dommage avant réception.'
    },
    allowSelf: true
  };
};

export const notifyBuyerDeliveryDistanceWarning = (params = {}) => {
  const payload = buildDeliveryDistanceWarningPayload(params);
  if (!payload) return Promise.resolve(null);
  return createNotification(payload);
};
