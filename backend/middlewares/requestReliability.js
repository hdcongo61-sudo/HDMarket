import { createAppError } from '../utils/appError.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_UPLOAD_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 2_000;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
};

const REQUEST_TIMEOUT_MS = parsePositiveInt(
  process.env.REQUEST_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS
);
const UPLOAD_REQUEST_TIMEOUT_MS = parsePositiveInt(
  process.env.UPLOAD_REQUEST_TIMEOUT_MS,
  DEFAULT_UPLOAD_REQUEST_TIMEOUT_MS
);
const SLOW_REQUEST_THRESHOLD_MS = parsePositiveInt(
  process.env.SLOW_REQUEST_THRESHOLD_MS,
  DEFAULT_SLOW_REQUEST_THRESHOLD_MS
);

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
  applyResponseGuards(res);

  const startedAt = Date.now();
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const isMultipartUpload = contentType.includes('multipart/form-data');
  const timeoutMs = isMultipartUpload ? UPLOAD_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
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
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const elapsedMs = Number(elapsedNs / 1_000_000n);
    if (elapsedMs < SLOW_REQUEST_THRESHOLD_MS) return;
    console.warn(
      `[slow] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs}ms`
    );
  });
  next();
};

export const requestReliabilityConfig = {
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  uploadRequestTimeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
  slowRequestThresholdMs: SLOW_REQUEST_THRESHOLD_MS
};
