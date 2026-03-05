import crypto from 'crypto';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 5000;

const responseCache = new Map();

const normalizePayload = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildScope = (req) => {
  const userId = String(req?.user?.id || req?.user?._id || 'anonymous');
  const method = String(req?.method || 'GET').toUpperCase();
  const path = String(req?.originalUrl || req?.url || '').split('?')[0];
  return `${userId}:${method}:${path}`;
};

const buildFingerprint = (req) => {
  const bodyText = normalizePayload(req?.body || {});
  return crypto.createHash('sha256').update(bodyText).digest('hex');
};

const pruneExpiredEntries = () => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      responseCache.delete(key);
    }
  }
  if (responseCache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(responseCache.entries()).sort(
    (a, b) => Number(a?.[1]?.createdAt || 0) - Number(b?.[1]?.createdAt || 0)
  );
  const removeCount = responseCache.size - MAX_CACHE_SIZE;
  for (let index = 0; index < removeCount; index += 1) {
    const cacheKey = entries[index]?.[0];
    if (cacheKey) {
      responseCache.delete(cacheKey);
    }
  }
};

export const idempotencyMiddleware = ({ ttlMs = DEFAULT_TTL_MS } = {}) => (req, res, next) => {
  const idempotencyKey = String(
    req?.headers?.['idempotency-key'] || req?.headers?.['x-idempotency-key'] || ''
  ).trim();

  if (!idempotencyKey) {
    res.setHeader('x-idempotency-status', 'missing');
    return next();
  }

  pruneExpiredEntries();

  const scope = buildScope(req);
  const cacheKey = `${scope}:${idempotencyKey}`;
  const requestFingerprint = buildFingerprint(req);
  const now = Date.now();
  const existing = responseCache.get(cacheKey);

  if (existing && Number(existing.expiresAt || 0) > now) {
    if (String(existing.fingerprint || '') !== requestFingerprint) {
      res.setHeader('x-idempotency-status', 'conflict');
      return res.status(409).json({
        message:
          "Clé d'idempotence déjà utilisée avec un payload différent. Veuillez générer une nouvelle requête.",
        code: 'IDEMPOTENCY_CONFLICT'
      });
    }

    res.setHeader('x-idempotency-status', 'replay');
    if (existing.requestId) {
      res.setHeader('x-request-id', existing.requestId);
    }
    return res.status(existing.statusCode || 200).json(existing.responseBody);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const statusCode = Number(res.statusCode || 200);
    // Cache deterministic responses only (2xx and 4xx). Ignore 5xx to allow retries.
    if (statusCode >= 200 && statusCode < 500) {
      responseCache.set(cacheKey, {
        fingerprint: requestFingerprint,
        statusCode,
        responseBody: body,
        requestId: String(
          res?.locals?.requestId ||
            req?.requestId ||
            res?.getHeader?.('x-request-id') ||
            ''
        ).trim(),
        createdAt: now,
        expiresAt: now + Math.max(10_000, Number(ttlMs || DEFAULT_TTL_MS))
      });
    }
    res.setHeader('x-idempotency-status', 'stored');
    return originalJson(body);
  };

  return next();
};

export default idempotencyMiddleware;
