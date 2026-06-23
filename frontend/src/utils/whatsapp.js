import { buildProductShareUrl, buildShopPath } from './links';

export const sanitizePhoneNumber = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/[^\d+]/g, '');
};

export const buildWhatsappMessage = (productTitle, productUrl) => {
  const title = productTitle ? `"${productTitle}"` : 'votre annonce';
  const link = productUrl || '';
  return encodeURIComponent(
    `Bonjour, je suis intéressé par ${title} sur HDMarket. Pouvez-vous me donner plus d'informations ? ${link}`.trim()
  );
};

export const buildWhatsappLink = (product, phone) => {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!product?._id || !sanitizedPhone) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const productUrl = buildProductShareUrl(product, origin);
  const message = buildWhatsappMessage(product.title, productUrl);
  return `https://wa.me/${sanitizedPhone}?text=${message}`;
};

export const buildShopWhatsappLink = (shop, phone) => {
  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!shop?._id || !sanitizedPhone) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shopPath = buildShopPath(shop);
  const shopUrl = origin && shopPath !== '/shop' ? `${origin}${shopPath}` : '';
  const shopName = shop.shopName || shop.name || 'votre boutique';
  const message = encodeURIComponent(
    `Bonjour, je souhaite contacter ${shopName} sur HDMarket. ${shopUrl}`.trim()
  );
  return `https://wa.me/${sanitizedPhone}?text=${message}`;
};
