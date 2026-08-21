import { buildSmartUrl } from './smartUrlService.js';

// Display symbol per currency code — keyed lookup, not a hardcoded default
// currency (§51: don't hardcode FCFA). Falls back to the raw code (e.g.
// "XOF") for anything not in the map, which still reads fine in a message.
const CURRENCY_SYMBOLS = {
  XAF: 'FCFA',
  XOF: 'FCFA',
  CDF: 'FC',
  USD: '$',
  EUR: '€'
};

const formatPrice = (value, currencyCode) => {
  const amount = Math.round(Number(value || 0));
  const symbol = CURRENCY_SYMBOLS[String(currencyCode || '').toUpperCase()] || currencyCode || '';
  return `${amount.toLocaleString('fr-FR')} ${symbol}`.trim();
};

const effectivePrice = (product) => {
  const discount = Number(product?.discount || 0);
  if (discount > 0) {
    return Number(product.price || 0) - (Number(product.price || 0) * discount) / 100;
  }
  return Number(product?.price || 0);
};

const shopLabel = (shop) => shop?.shopName || shop?.name || 'Boutique HDMarket';

const productLine = (product) => `🛍 ${product?.title || 'Produit HDMarket'}`;

const linkLine = (product, socialCode, channel, campaign) =>
  `Voir le produit et commander :\n${buildSmartUrl(socialCode, { source: String(channel || '').toLowerCase(), campaign })}`;

/**
 * Builds the outbound text reply for a resolved product + detected intent.
 * Always reads live fields off the passed `product` document — never a
 * cached/stored price — so an edited price is reflected on the very next
 * message (spec §7/§36 Scenario D). Reuses the product's own
 * wholesale/installment fields rather than recomputing business rules.
 */
export const buildSocialResponse = ({ channel, intent, product, shop, socialCode, campaign }) => {
  if (!product) {
    return buildUnknownProductResponse();
  }

  const price = formatPrice(effectivePrice(product), product.currency);
  const link = linkLine(product, socialCode, channel, campaign);

  switch (intent) {
    case 'WHOLESALE': {
      const smartUrl = buildSmartUrl(socialCode, { source: String(channel || '').toLowerCase(), campaign });
      if (!product.wholesaleEnabled || !Array.isArray(product.wholesaleTiers) || !product.wholesaleTiers.length) {
        return `${productLine(product)}\n\nPrix : ${price}\n\nCe produit n'a pas de tarif de gros actif pour le moment.\n\nVoir le produit :\n${smartUrl}`;
      }
      const minQty = Math.min(...product.wholesaleTiers.map((tier) => Number(tier.minQty || 0)));
      return (
        `${productLine(product)}\n\n` +
        `Prix normal : ${price}\n\n` +
        `Tarifs en gros disponibles à partir de ${minQty} unités.\n\n` +
        `Voir les tarifs :\n${smartUrl}`
      );
    }
    case 'INSTALLMENT': {
      if (!product.installmentEnabled) {
        return `${productLine(product)}\n\nCe produit n'est pas disponible en paiement par tranche pour le moment.\n\n${link}`;
      }
      return `Ce produit est disponible avec paiement par tranche.\n\nVoir les conditions :\n${buildSmartUrl(socialCode, { source: String(channel || '').toLowerCase(), campaign })}`;
    }
    case 'DELIVERY': {
      const modes = [];
      if (product.deliveryAvailable) modes.push('livraison');
      if (product.pickupAvailable) modes.push('retrait boutique');
      const modesLine = modes.length ? `Options disponibles : ${modes.join(', ')}.` : '';
      return (
        `${productLine(product)}\n\n` +
        `La livraison dépend de votre zone.\n${modesLine}\n\n` +
        `Ouvrez le produit sur HDMarket et indiquez votre ville/commune pour voir les options exactes :\n${buildSmartUrl(socialCode, { source: String(channel || '').toLowerCase(), campaign })}`
      );
    }
    case 'ORDER':
      return (
        `${productLine(product)}\n\n` +
        `Prix : ${price}\n\n` +
        `Vous pouvez commander ce produit directement sur HDMarket :\n${buildSmartUrl(socialCode, { source: String(channel || '').toLowerCase(), campaign })}`
      );
    case 'SHOP_INFO':
      return (
        `🏪 ${shopLabel(shop)}\n` +
        (shop?.shopVerified ? 'Boutique vérifiée HDMarket ✅\n' : '') +
        (shop?.city ? `Ville : ${shop.city}\n` : '') +
        `\n${link}`
      );
    case 'AVAILABILITY':
      return `${productLine(product)}\n\nCe produit est actuellement disponible.\n\n${link}`;
    case 'PRODUCT_INFO':
      return (
        `${productLine(product)}\n\n` +
        `Prix : ${price}\n` +
        `Boutique : ${shopLabel(shop)}\n\n` +
        link
      );
    case 'GREETING':
      return buildGreetingResponse();
    case 'PRICE':
    default:
      return `${productLine(product)}\n\nPrix : ${price}\nBoutique : ${shopLabel(shop)}\n\n${link}`;
  }
};

export const buildUnknownProductResponse = () =>
  "Je n'ai pas trouvé le produit.\n\n" +
  "Envoyez-moi la référence HD-XXXXX indiquée sur la publication, ou ouvrez HDMarket pour rechercher le produit :\n" +
  `${String(process.env.HDMARKET_PUBLIC_URL || '').replace(/\/+$/, '')}/products`;

export const buildUnavailableProductResponse = () =>
  'Ce produit n\'est actuellement plus disponible sur HDMarket.\n\n' +
  'Découvrez des produits similaires :\n' +
  `${String(process.env.HDMARKET_PUBLIC_URL || '').replace(/\/+$/, '')}/products`;

export const buildGreetingResponse = () =>
  'Bonjour 👋\n\n' +
  "Envoyez-moi la référence HD-XXXXX d'un produit HDMarket et je peux vous donner son prix et son lien.";
