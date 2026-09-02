import * as Sentry from '@sentry/node';

// Opt-in: does nothing unless SENTRY_DSN is set (no account/DSN required to
// deploy this). Complements, not replaces, the existing ErrorLog DB persistence
// in middlewares/globalErrorHandler.js — that stays the durable, queryable
// record; this adds real-time alerting on top for 500-level errors so they're
// known about before a user reports them, instead of only discoverable by
// querying the ErrorLog collection after the fact.
//
// Reporting is manual (captureServerError from the global error handler) rather
// than auto-instrumented, so it does not depend on Sentry.init() running before
// the express import — which it does not, since server.js calls this after its
// own module graph is loaded.
const dsn = process.env.SENTRY_DSN || '';
export const errorTrackingEnabled = Boolean(dsn);

// Keys whose values must never reach a third party. Kept in sync with
// SENSITIVE_FIELDS in middlewares/globalErrorHandler.js.
const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'refreshtoken',
  'accesstoken',
  'jwt',
  'secret',
  'apikey',
  'otp',
  'verificationcode',
  'transactioncode',
  'paymenttransactioncode'
];

const isSensitiveKey = (key = '') => {
  const lower = String(key).toLowerCase();
  return SENSITIVE_KEYS.some((field) => lower.includes(field));
};

const redact = (value, depth = 0) => {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item, depth + 1));
  return Object.entries(value).reduce((acc, [key, item]) => {
    acc[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(item, depth + 1);
    return acc;
  }, {});
};

// Password reset and payment-verification links carry tokens as query params.
const scrubUrl = (value) => {
  const raw = String(value || '');
  if (!raw.includes('?')) return raw;
  const [base, query] = raw.split('?');
  try {
    const params = new URLSearchParams(query);
    let touched = false;
    for (const key of [...params.keys()]) {
      if (isSensitiveKey(key)) {
        params.set(key, '[REDACTED]');
        touched = true;
      }
    }
    return touched ? `${base}?${params.toString()}` : raw;
  } catch {
    return base;
  }
};

export const initErrorTracking = () => {
  if (!errorTrackingEnabled) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Correlates a backend error with the frontend build in the same incident.
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    // Never attach IPs, cookies, or request bodies automatically — everything
    // sent is passed explicitly through captureServerError and redacted first.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (isSensitiveKey(key)) event.request.headers[key] = '[REDACTED]';
        }
      }
      if (event.request?.data) event.request.data = redact(event.request.data);
      return event;
    }
  });
};

export const captureServerError = (err, context = {}) => {
  if (!errorTrackingEnabled) return;
  const { userId, role, requestId, method, path, code, ...rest } = context;
  Sentry.captureException(err, {
    tags: {
      ...(code ? { code: String(code) } : {}),
      ...(method ? { method: String(method) } : {}),
      ...(role ? { 'user.role': String(role) } : {})
    },
    // Id only: name, email, and phone are PII and are not sent.
    user: userId ? { id: String(userId) } : undefined,
    extra: {
      ...(requestId ? { requestId: String(requestId) } : {}),
      ...(path ? { path: scrubUrl(path) } : {}),
      ...redact(rest)
    }
  });
};
