import { randomUUID } from 'crypto';

const MAX_REQUEST_ID_LENGTH = 120;

const normalizeRequestId = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_REQUEST_ID_LENGTH) {
    return trimmed.slice(0, MAX_REQUEST_ID_LENGTH);
  }
  return trimmed;
};

export const requestContextMiddleware = (req, res, next) => {
  const inboundRequestId =
    normalizeRequestId(req.headers['x-request-id']) ||
    normalizeRequestId(req.headers['x-correlation-id']);

  const requestId = inboundRequestId || randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
};

export default requestContextMiddleware;

