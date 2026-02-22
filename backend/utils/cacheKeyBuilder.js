import { createHash } from 'crypto';

const sanitizePart = (value, fallback = 'na') => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  if (text === '*') return '*';
  return text.replace(/[^a-z0-9:_*-]+/g, '_').slice(0, 140);
};

export const normalizeCacheEnv = () => {
  const raw = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev').toLowerCase();
  if (raw.startsWith('prod')) return 'prod';
  if (raw.startsWith('stag')) return 'staging';
  if (raw.startsWith('test')) return 'test';
  return 'dev';
};

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const entry = value[key];
        if (entry === undefined) return acc;
        acc[key] = sortObject(entry);
        return acc;
      }, {});
  }
  return value;
};

const stringifyParams = (params = {}) => {
  try {
    const normalized = sortObject(params);
    const raw = JSON.stringify(normalized);
    if (!raw || raw === '{}' || raw === '[]') return 'base';
    const digest = createHash('sha1').update(raw).digest('hex').slice(0, 24);
    return `h_${digest}`;
  } catch {
    return 'base';
  }
};

const getPrimaryPathSegment = (path = '') => {
  const clean = String(path || '').split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length) return 'misc';
  if (parts[0] === 'api' && parts[1]) return parts[1];
  return parts[0];
};

const getResourceIdFromReq = (req, fallback = 'list') => {
  if (req?.params?.id) return req.params.id;
  if (req?.params?.orderId) return req.params.orderId;
  if (req?.params?.productId) return req.params.productId;
  return fallback;
};

const getUserIdFromReq = (req) => String(req?.user?.id || req?.user?._id || '').trim();

const getRouteSignature = (req) => {
  const routePath = String(req?.route?.path || req?.path || req?.originalUrl || '').split('?')[0];
  if (!routePath) return 'root';
  return sanitizePart(routePath.replace(/\//g, '_'), 'root');
};

const resolveScope = ({ req, scope = 'auto', domain = '' }) => {
  const desiredScope = String(scope || 'auto').toLowerCase();
  const userId = getUserIdFromReq(req);
  const role = sanitizePart(req?.user?.role || 'guest', 'guest');

  if (desiredScope === 'public') {
    return { scope: 'public', id: 'global' };
  }

  if (desiredScope === 'user') {
    return { scope: 'user', id: userId || 'guest' };
  }

  if (desiredScope === 'seller') {
    return { scope: 'seller', id: userId || 'guest' };
  }

  if (desiredScope === 'admin') {
    return { scope: 'admin', id: userId || 'guest' };
  }

  if (desiredScope === 'role') {
    return { scope: 'role', id: role || 'guest' };
  }

  if (!userId) {
    return { scope: 'public', id: 'global' };
  }

  if (domain === 'admin' || String(req?.originalUrl || '').startsWith('/api/admin')) {
    return { scope: 'role', id: role };
  }

  if (String(req?.originalUrl || '').includes('/seller/')) {
    return { scope: 'seller', id: userId };
  }

  return { scope: 'user', id: userId };
};

export const buildCacheKey = ({
  env = normalizeCacheEnv(),
  domain,
  scope,
  id,
  params
}) => {
  return [
    sanitizePart(env, 'dev'),
    sanitizePart(domain, 'misc'),
    sanitizePart(scope, 'public'),
    sanitizePart(id, 'global'),
    stringifyParams(params)
  ].join(':');
};

export const buildCachePattern = ({
  env = normalizeCacheEnv(),
  domain = '*',
  scope = '*',
  id = '*',
  params = '*'
} = {}) =>
  [sanitizePart(env, 'dev'), sanitizePart(domain, '*'), sanitizePart(scope, '*'), sanitizePart(id, '*'), sanitizePart(params, '*')].join(':');

export const buildRequestCacheKey = (req, options = {}) => {
  const domain = sanitizePart(options.domain || getPrimaryPathSegment(req?.baseUrl || req?.path || req?.url || ''), 'misc');
  const resolved = resolveScope({ req, scope: options.scope || 'auto', domain });

  const scopeId =
    typeof options.scopeIdResolver === 'function'
      ? options.scopeIdResolver(req, resolved)
      : options.scopeId;

  const explicitId =
    typeof options.resourceIdResolver === 'function'
      ? options.resourceIdResolver(req, resolved)
      : options.resourceId;

  const id = scopeId || explicitId || resolved.id || getResourceIdFromReq(req, 'list');

  const paramsPayload = {
    _params: req?.params || {},
    ...(options.includeQuery === false ? {} : req?.query || {}),
    _route: getRouteSignature(req)
  };

  return buildCacheKey({
    domain,
    scope: resolved.scope,
    id,
    params: paramsPayload
  });
};

export const getCacheContextFromRequest = (req, options = {}) => {
  const domain = sanitizePart(options.domain || getPrimaryPathSegment(req?.baseUrl || req?.path || req?.url || ''), 'misc');
  const resolved = resolveScope({ req, scope: options.scope || 'auto', domain });
  return {
    domain,
    scope: resolved.scope,
    id: resolved.id
  };
};

export const wildcardToRegExp = (pattern) => {
  const escaped = String(pattern || '')
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
};
