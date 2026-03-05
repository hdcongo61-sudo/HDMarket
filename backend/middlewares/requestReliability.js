import { createAppError } from '../utils/appError.js';
import { getRuntimeConfig } from '../services/configService.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_UPLOAD_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 2_000;
const DEFAULT_CHECKOUT_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_PAYMENT_REQUEST_TIMEOUT_MS = 60_000;
const RUNTIME_REFRESH_INTERVAL_MS = 15_000;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
};

const RUNTIME_KEYS = Object.freeze({
  requestTimeoutMs: 'api_request_timeout_ms',
  checkoutRequestTimeoutMs: 'api_checkout_timeout_ms',
  paymentRequestTimeoutMs: 'api_payment_submit_timeout_ms',
  uploadRequestTimeoutMs: 'api_upload_timeout_ms',
  slowRequestThresholdMs: 'api_slow_request_threshold_ms'
});

const ENV_DEFAULT_CONFIG = Object.freeze({
  requestTimeoutMs: parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS),
  checkoutRequestTimeoutMs: parsePositiveInt(
    process.env.CHECKOUT_REQUEST_TIMEOUT_MS,
    DEFAULT_CHECKOUT_REQUEST_TIMEOUT_MS
  ),
  paymentRequestTimeoutMs: parsePositiveInt(
    process.env.PAYMENT_REQUEST_TIMEOUT_MS,
    DEFAULT_PAYMENT_REQUEST_TIMEOUT_MS
  ),
  uploadRequestTimeoutMs: parsePositiveInt(
    process.env.UPLOAD_REQUEST_TIMEOUT_MS,
    DEFAULT_UPLOAD_REQUEST_TIMEOUT_MS
  ),
  slowRequestThresholdMs: parsePositiveInt(
    process.env.SLOW_REQUEST_THRESHOLD_MS,
    DEFAULT_SLOW_REQUEST_THRESHOLD_MS
  )
});

let activeReliabilityConfig = { ...ENV_DEFAULT_CONFIG };
let lastRuntimeRefreshAt = 0;
let runtimeRefreshPromise = null;

const CHECKOUT_TIMEOUT_RULES = [
  { method: 'POST', path: '/api/orders/checkout' },
  { method: 'POST', path: '/api/orders/installment/checkout' }
];
const PAYMENT_TIMEOUT_RULES = [{ method: 'POST', path: '/api/payments' }];

const normalizeReliabilityConfig = (raw = {}) => ({
  requestTimeoutMs: parsePositiveInt(raw.requestTimeoutMs, ENV_DEFAULT_CONFIG.requestTimeoutMs),
  checkoutRequestTimeoutMs: parsePositiveInt(
    raw.checkoutRequestTimeoutMs,
    ENV_DEFAULT_CONFIG.checkoutRequestTimeoutMs
  ),
  paymentRequestTimeoutMs: parsePositiveInt(
    raw.paymentRequestTimeoutMs,
    ENV_DEFAULT_CONFIG.paymentRequestTimeoutMs
  ),
  uploadRequestTimeoutMs: parsePositiveInt(
    raw.uploadRequestTimeoutMs,
    ENV_DEFAULT_CONFIG.uploadRequestTimeoutMs
  ),
  slowRequestThresholdMs: parsePositiveInt(
    raw.slowRequestThresholdMs,
    ENV_DEFAULT_CONFIG.slowRequestThresholdMs
  )
});

const fetchRuntimeReliabilityConfig = async () => {
  const [
    requestTimeoutMs,
    checkoutRequestTimeoutMs,
    paymentRequestTimeoutMs,
    uploadRequestTimeoutMs,
    slowRequestThresholdMs
  ] = await Promise.all([
    getRuntimeConfig(RUNTIME_KEYS.requestTimeoutMs, {
      fallback: ENV_DEFAULT_CONFIG.requestTimeoutMs
    }),
    getRuntimeConfig(RUNTIME_KEYS.checkoutRequestTimeoutMs, {
      fallback: ENV_DEFAULT_CONFIG.checkoutRequestTimeoutMs
    }),
    getRuntimeConfig(RUNTIME_KEYS.paymentRequestTimeoutMs, {
      fallback: ENV_DEFAULT_CONFIG.paymentRequestTimeoutMs
    }),
    getRuntimeConfig(RUNTIME_KEYS.uploadRequestTimeoutMs, {
      fallback: ENV_DEFAULT_CONFIG.uploadRequestTimeoutMs
    }),
    getRuntimeConfig(RUNTIME_KEYS.slowRequestThresholdMs, {
      fallback: ENV_DEFAULT_CONFIG.slowRequestThresholdMs
    })
  ]);

  return normalizeReliabilityConfig({
    requestTimeoutMs,
    checkoutRequestTimeoutMs,
    paymentRequestTimeoutMs,
    uploadRequestTimeoutMs,
    slowRequestThresholdMs
  });
};

const shouldRefreshRuntimeConfig = () =>
  Date.now() - lastRuntimeRefreshAt >= RUNTIME_REFRESH_INTERVAL_MS;

const refreshRuntimeReliabilityConfig = async ({ force = false } = {}) => {
  if (!force && runtimeRefreshPromise) return runtimeRefreshPromise;
  if (!force && !shouldRefreshRuntimeConfig()) return activeReliabilityConfig;

  runtimeRefreshPromise = fetchRuntimeReliabilityConfig()
    .then((nextConfig) => {
      activeReliabilityConfig = nextConfig;
      lastRuntimeRefreshAt = Date.now();
      return activeReliabilityConfig;
    })
    .catch(() => {
      lastRuntimeRefreshAt = Date.now();
      return activeReliabilityConfig;
    })
    .finally(() => {
      runtimeRefreshPromise = null;
    });

  return runtimeRefreshPromise;
};

const scheduleRuntimeRefresh = () => {
  if (!shouldRefreshRuntimeConfig() || runtimeRefreshPromise) return;
  void refreshRuntimeReliabilityConfig();
};

const resolveTimeoutMs = ({ req, isMultipartUpload, config = activeReliabilityConfig }) => {
  if (isMultipartUpload) return config.uploadRequestTimeoutMs;
  const method = String(req.method || '').toUpperCase();
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const isCheckoutRoute = CHECKOUT_TIMEOUT_RULES.some(
    (rule) => rule.method === method && path === rule.path
  );
  if (isCheckoutRoute) return config.checkoutRequestTimeoutMs;
  const isPaymentSubmitRoute = PAYMENT_TIMEOUT_RULES.some(
    (rule) => rule.method === method && path === rule.path
  );
  if (isPaymentSubmitRoute) return config.paymentRequestTimeoutMs;
  return config.requestTimeoutMs;
};

const applyResponseGuards = (res) => {
  const safeWrap = (methodName) => {
    const original = res[methodName]?.bind(res);
    if (typeof original !== 'function') return;
    res[methodName] = (...args) => {
      if (res.locals?.requestTimedOut || res.headersSent || res.writableEnded) {
        return res;
      }
      return original(...args);
    };
  };

  safeWrap('status');
  safeWrap('json');
  safeWrap('send');
  safeWrap('end');
};

export const requestTimeoutMiddleware = (req, res, next) => {
  scheduleRuntimeRefresh();
  applyResponseGuards(res);

  const startedAt = Date.now();
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const isMultipartUpload = contentType.includes('multipart/form-data');
  const timeoutMs = resolveTimeoutMs({ req, isMultipartUpload, config: activeReliabilityConfig });
  let timer = null;

  const clearTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  res.locals.requestTimedOut = false;
  res.setHeader('x-request-timeout-ms', String(timeoutMs));

  timer = setTimeout(() => {
    if (res.headersSent || res.writableEnded) return;
    res.locals.requestTimedOut = true;
    const elapsedMs = Date.now() - startedAt;
    console.warn(
      `[timeout] ${req.method} ${req.originalUrl} exceeded ${timeoutMs}ms (elapsed ${elapsedMs}ms)`
    );
    const timeoutError = createAppError('Le serveur met trop de temps à répondre. Réessayez.', {
      status: 504,
      code: 'TIMEOUT_ERROR',
      details: { elapsedMs, timeoutMs, requestId: res.locals?.requestId || req.requestId || '' }
    });
    timeoutError.name = 'TimeoutError';
    next(timeoutError);
  }, timeoutMs);

  res.on('finish', clearTimer);
  res.on('close', clearTimer);
  next();
};

export const slowRequestLogger = (req, res, next) => {
  scheduleRuntimeRefresh();
  const thresholdMs = activeReliabilityConfig.slowRequestThresholdMs;
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const elapsedMs = Number(elapsedNs / 1_000_000n);
    if (elapsedMs < thresholdMs) return;
    console.warn(
      `[slow] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs}ms`
    );
  });
  next();
};

export const getRequestReliabilityConfig = async ({ forceRefresh = false } = {}) => {
  if (forceRefresh) {
    await refreshRuntimeReliabilityConfig({ force: true });
  } else {
    scheduleRuntimeRefresh();
  }
  return { ...activeReliabilityConfig };
};

export const requestReliabilityConfig = Object.freeze({
  get requestTimeoutMs() {
    return activeReliabilityConfig.requestTimeoutMs;
  },
  get checkoutRequestTimeoutMs() {
    return activeReliabilityConfig.checkoutRequestTimeoutMs;
  },
  get paymentRequestTimeoutMs() {
    return activeReliabilityConfig.paymentRequestTimeoutMs;
  },
  get uploadRequestTimeoutMs() {
    return activeReliabilityConfig.uploadRequestTimeoutMs;
  },
  get slowRequestThresholdMs() {
    return activeReliabilityConfig.slowRequestThresholdMs;
  }
});
