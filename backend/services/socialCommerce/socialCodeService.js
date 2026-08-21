import crypto from 'crypto';

// Human-friendly, hard-to-guess-sequentially alphabet: no 0/O, 1/I/L
// confusion pairs. 31 chars ^ 5 ≈ 28.6M combinations — plenty for a
// per-product code with collision-retry, and short enough to read aloud
// or type from a TikTok caption.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;
const CODE_PREFIX = 'HD-';

/**
 * Generates one random candidate code (e.g. "HD-8F42K"). Does not check
 * uniqueness — callers retry against the DB on collision, same pattern as
 * Product's confirmationNumber generator in productModel.js.
 */
export const generateSocialCode = () => {
  let body = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    body += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}${body}`;
};

/**
 * Normalizes free-form user input ("hd8f42k", "HD-8F42K", "hd 8f42k") into
 * the canonical stored form ("HD-8F42K"), or '' if it doesn't look like a
 * social code at all. Case-insensitive, dash/space-tolerant.
 */
export const normalizeSocialCode = (input) => {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw.startsWith('HD') || raw.length < 2 + CODE_LENGTH) return '';
  const body = raw.slice(2, 2 + CODE_LENGTH);
  if (body.length !== CODE_LENGTH) return '';
  return `${CODE_PREFIX}${body}`;
};

/**
 * Finds every HD-XXXXX-shaped token in free text (a WhatsApp/Instagram/
 * Messenger message may contain other words around the code). Returns
 * normalized codes, de-duplicated, in the order they appear.
 */
export const extractSocialCodeCandidates = (text) => {
  const matches = String(text || '').toUpperCase().match(/HD[-\s]?([A-Z0-9]{4,8})/g) || [];
  const seen = new Set();
  const codes = [];
  for (const match of matches) {
    const normalized = normalizeSocialCode(match);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      codes.push(normalized);
    }
  }
  return codes;
};
