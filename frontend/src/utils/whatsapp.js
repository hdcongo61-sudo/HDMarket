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
  const productUrl = `${origin}/product/${product._id}`;
  const message = buildWhatsappMessage(product.title, productUrl);
  return `https://wa.me/${sanitizedPhone}?text=${message}`;
};

