// Deterministic keyword-based intent detection (FR + EN). Pure function by
// design: { text, locale } in, { intent, rawIntent } out — so a future
// AI/NLP-based detector can be swapped in later without touching any
// connector or controller (they only ever call detectIntent()).
export const INTENTS = Object.freeze([
  'PRICE',
  'AVAILABILITY',
  'DELIVERY',
  'ORDER',
  'PRODUCT_INFO',
  'SHOP_INFO',
  'WHOLESALE',
  'INSTALLMENT',
  'GREETING',
  'UNKNOWN'
]);

// Ordered by specificity: a message containing both "gros" and "prix" should
// resolve to WHOLESALE (more specific intent), not PRICE — so WHOLESALE/
// INSTALLMENT/ORDER/DELIVERY are checked before the generic PRICE/AVAILABILITY.
const RULES = [
  {
    intent: 'WHOLESALE',
    keywords: ['gros', 'wholesale', 'quantité', 'quantite', 'bulk', 'en gros']
  },
  {
    intent: 'INSTALLMENT',
    keywords: ['tranche', 'tranches', 'installment', 'installments', 'paiement échelonné', 'echelonne', 'facilité']
  },
  {
    intent: 'ORDER',
    keywords: ['acheter', 'commander', 'commande', 'je veux', 'je prends', 'buy', 'order', 'purchase', 'i want']
  },
  {
    intent: 'DELIVERY',
    keywords: ['livrer', 'livraison', 'livrez', 'deliver', 'delivery', 'shipping']
  },
  {
    intent: 'SHOP_INFO',
    keywords: ['boutique', 'vendeur', 'shop', 'seller', 'qui vend', 'store']
  },
  {
    intent: 'AVAILABILITY',
    keywords: ['disponible', 'dispo', 'stock', 'available', 'availability', 'reste-t-il', 'il en reste']
  },
  {
    intent: 'PRICE',
    keywords: ['prix', 'combien', 'coute', 'coûte', 'price', 'cost', 'how much']
  },
  {
    intent: 'PRODUCT_INFO',
    keywords: ['info', 'infos', 'information', 'détails', 'details', 'description', 'renseignement']
  },
  {
    intent: 'GREETING',
    keywords: ['bonjour', 'salut', 'bonsoir', 'hello', 'hi', 'hey', 'coucou']
  }
];

const normalizeText = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * @param {{text: string, locale?: string}} input
 * @returns {{intent: string, rawIntent: string}} rawIntent mirrors intent for
 *   now (kept as a separate field so a future ML detector can report its own
 *   raw label distinct from the normalized HDMarket intent enum).
 */
export const detectIntent = ({ text } = {}) => {
  const normalized = normalizeText(text);
  if (!normalized) return { intent: 'UNKNOWN', rawIntent: '' };

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return { intent: rule.intent, rawIntent: rule.intent };
    }
  }

  return { intent: 'UNKNOWN', rawIntent: '' };
};
