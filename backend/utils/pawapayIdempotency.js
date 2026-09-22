import crypto from 'crypto';

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};

export const getPawaPayRequestIdentity = (req) => {
  const key = String(req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'] || '').trim();
  if (!key) return null;
  const userId = String(req.user?._id || req.user?.id || '');
  const bytes = crypto.createHash('sha256').update(JSON.stringify(['pawapay-checkout', userId, key])).digest().subarray(0, 16);
  // Deterministic UUID scoped to the authenticated user; the unique checkoutId
  // index reserves the request across workers and after process restarts.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return {
    checkoutId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    requestFingerprint: crypto.createHash('sha256').update(JSON.stringify(canonical(req.body || {}))).digest('hex')
  };
};
