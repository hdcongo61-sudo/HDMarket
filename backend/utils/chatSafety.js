// Heuristic detector for the classic P2P-marketplace scam: a party asks the
// other to pay directly (Mobile Money, bank transfer, cash outside the app)
// instead of through HDMarket checkout, where there's no dispute/escrow
// protection. We never block the message — false positives are common
// (sharing a delivery contact number, for instance) — we only flag it so
// the frontend can show a non-blocking safety reminder inline.

const PAYMENT_KEYWORDS =
  /\b(momo|mobile\s*money|airtel\s*money|virement|vire[sz]?[-\s]?moi|paye[sz]?[-\s]?moi|envoie[sz]?[-\s]?moi|d[ée]p[ôo]t|paiement\s+direct|payer\s+directement|hors\s+(plateforme|app(lication)?|hdmarket)|en\s+dehors\s+de\s+(l['’]app|hdmarket)|whatsapp|contact\s+direct)\b/i;

// Congolese numbers are grouped inconsistently in free text (06 123 45 67,
// 242061234567, +242-06-123-4567...), so rather than matching an exact
// digit-grouping pattern, find digit runs (allowing spaces/dots/dashes as
// separators) and check whether enough actual digits survive stripping —
// 8+ covers a local 9-digit number minus its leading 0, up to the full
// +242 country-code form.
const DIGIT_RUN = /\d[\d\s.-]{6,}\d/g;

const containsPhoneLikeNumber = (text) => {
  const runs = text.match(DIGIT_RUN) || [];
  return runs.some((run) => run.replace(/\D/g, '').length >= 8);
};

export const detectOffPlatformPaymentRisk = (text) => {
  const value = String(text || '');
  if (!value.trim()) return false;
  return PAYMENT_KEYWORDS.test(value) && containsPhoneLikeNumber(value);
};
