import mongoose from 'mongoose';
import ErrorLog from '../models/errorLogModel.js';

const isProduction = process.env.NODE_ENV === 'production';
const ENABLE_DB_ERROR_LOGS = String(process.env.ENABLE_DB_ERROR_LOGS || 'true') !== 'false';

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'refreshToken',
  'accessToken',
  'jwt',
  'secret',
  'apiKey',
  'otp',
  'verificationCode',
  'transactionCode',
  'paymentTransactionCode'
];

const redactSensitive = (value, depth = 0) => {
  if (value == null) return value;
  if (depth > 3) return '[MaxDepth]';
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, item]) => {
      const lower = String(key || '').toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lower.includes(field.toLowerCase()))) {
        acc[key] = '[REDACTED]';
      } else {
        acc[key] = redactSensitive(item, depth + 1);
      }
      return acc;
    }, {});
  }
  if (typeof value === 'string' && value.length > 800) {
    return `${value.slice(0, 800)}...[truncated]`;
  }
  return value;
};

const firstValidationMessage = (err) => {
  if (!err?.errors) return 'Les données envoyées sont invalides.';
  const first = Object.values(err.errors)[0];
  return String(first?.message || 'Les données envoyées sont invalides.');
};

const toClientError = (err) => {
  const normalizedName = String(err?.name || '');
  const status = Number(err?.status || err?.statusCode || 0);

  if (normalizedName === 'ValidationError') {
    return { status: 400, code: 'VALIDATION_ERROR', message: firstValidationMessage(err), expose: true };
  }
  if (normalizedName === 'CastError') {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Identifiant invalide.', expose: true };
  }
  if (err?.code === 11000) {
    return { status: 409, code: 'CONFLICT_ERROR', message: 'Cette ressource existe déjà.', expose: true };
  }
  if (normalizedName === 'JsonWebTokenError' || normalizedName === 'TokenExpiredError') {
    return { status: 401, code: 'AUTHENTICATION_ERROR', message: 'Session expirée. Veuillez vous reconnecter.', expose: true };
  }
  if (normalizedName === 'TimeoutError' || err?.code === 'TIMEOUT_ERROR' || status === 504) {
    return { status: 504, code: 'TIMEOUT_ERROR', message: 'Le serveur met trop de temps à répondre. Réessayez.', expose: true };
  }
  if (normalizedName === 'AuthenticationError' || status === 401) {
    return { status: 401, code: 'AUTHENTICATION_ERROR', message: 'Authentification requise.', expose: true };
  }
  if (normalizedName === 'AuthorizationError' || status === 403) {
    return { status: 403, code: 'AUTHORIZATION_ERROR', message: "Vous n'avez pas accès à cette ressource.", expose: true };
  }
  if (normalizedName === 'NotFoundError' || status === 404) {
    return { status: 404, code: 'NOT_FOUND_ERROR', message: 'Ressource introuvable.', expose: true };
  }
  if (normalizedName === 'ConflictError' || status === 409) {
    return { status: 409, code: 'CONFLICT_ERROR', message: 'Conflit de données.', expose: true };
  }
  if (normalizedName === 'RateLimitError' || status === 429) {
    return { status: 429, code: 'RATE_LIMIT_ERROR', message: 'Trop de requêtes. Réessayez plus tard.', expose: true };
  }
  if (status >= 400 && status < 500) {
    return {
      status,
      code: 'REQUEST_ERROR',
      message: err?.message || 'La requête est invalide.',
      expose: true
    };
  }

  return {
    status: 500,
    code: 'SERVER_ERROR',
    message: 'Une erreur est survenue. Veuillez réessayer.',
    expose: false
  };
};

const persistCriticalError = async ({ requestId, req, mapped, err }) => {
  if (!ENABLE_DB_ERROR_LOGS || mapped.status < 500) return;
  try {
    await ErrorLog.create({
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: mapped.status,
      code: mapped.code,
      message: String(err?.message || mapped.message || ''),
      stack: String(err?.stack || ''),
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      userId: mongoose.Types.ObjectId.isValid(req?.user?._id) ? req.user._id : null,
      meta: {
        params: redactSensitive(req.params || {}),
        query: redactSensitive(req.query || {}),
        body: redactSensitive(req.body || {}),
        details: redactSensitive(err?.details || err?.meta || {})
      }
    });
  } catch {
    // ignore persistence failures
  }
};

export const notFoundApiHandler = (req, _res, next) => {
  const error = new Error(`Route API introuvable: ${req.originalUrl}`);
  error.name = 'NotFoundError';
  error.status = 404;
  error.code = 'NOT_FOUND_ERROR';
  next(error);
};

export const globalErrorHandler = (err, req, res, _next) => {
  const requestId = res.locals?.requestId || req.requestId || 'unknown';
  const mapped = toClientError(err || {});

  const safeLog = {
    requestId,
    status: mapped.status,
    code: mapped.code,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    message: err?.message || mapped.message,
    details: redactSensitive(err?.details || err?.meta || {}),
    params: redactSensitive(req.params || {}),
    query: redactSensitive(req.query || {}),
    body: redactSensitive(req.body || {})
  };

  if (mapped.status >= 500) {
    console.error('[api-error]', safeLog, err?.stack || '');
  } else {
    console.warn('[api-error]', safeLog);
  }

  void persistCriticalError({ requestId, req, mapped, err });

  if (res.headersSent || res.writableEnded) {
    return;
  }

  const responseBody = {
    success: false,
    message:
      isProduction && !mapped.expose
        ? 'Une erreur est survenue. Veuillez réessayer.'
        : mapped.message,
    code: mapped.code,
    requestId
  };

  if (!isProduction && err?.stack) {
    responseBody.debug = { stack: String(err.stack).split('\n').slice(0, 12).join('\n') };
  }

  res.status(mapped.status).json(responseBody);
};

export default globalErrorHandler;

