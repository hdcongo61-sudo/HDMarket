import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getRedisClient, initRedis, isRedisReady } from '../config/redisClient.js';

const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : process.env.NODE_ENV || 'dev';
const TOKEN_BLACKLIST_PREFIX = `${ENV_PREFIX}:auth:blacklist:token:`;

const toUnixSeconds = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const hashToken = (token = '') => crypto.createHash('sha256').update(String(token)).digest('hex');

const getTokenBlacklistKey = (token = '') => `${TOKEN_BLACKLIST_PREFIX}${hashToken(token)}`;

const getTokenExpirySeconds = (token = '') => {
  try {
    const decoded = jwt.decode(token);
    return toUnixSeconds(decoded?.exp);
  } catch {
    return 0;
  }
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

export const blacklistToken = async (token, options = {}) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) return false;
  const client = await ensureRedis();
  if (!client) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expSeconds = Math.max(
    toUnixSeconds(options.exp),
    getTokenExpirySeconds(rawToken),
    nowSeconds + 60
  );
  const ttlSeconds = Math.max(60, expSeconds - nowSeconds);

  const payload = JSON.stringify({
    reason: String(options.reason || 'manual_invalidation'),
    at: new Date().toISOString()
  });

  try {
    await client.set(getTokenBlacklistKey(rawToken), payload, { EX: ttlSeconds });
    return true;
  } catch {
    return false;
  }
};

export const isTokenBlacklisted = async (token) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) return false;
  const client = await ensureRedis();
  if (!client) return false;
  try {
    const exists = await client.exists(getTokenBlacklistKey(rawToken));
    return Number(exists) > 0;
  } catch {
    return false;
  }
};

export const wasSessionInvalidated = (user = {}, decoded = {}) => {
  const invalidatedAt = user?.sessionsInvalidatedAt ? new Date(user.sessionsInvalidatedAt).getTime() : 0;
  if (!invalidatedAt) return false;
  const issuedAtSeconds = toUnixSeconds(decoded?.iat);
  if (!issuedAtSeconds) return false;
  return issuedAtSeconds * 1000 <= invalidatedAt;
};

export const extractBearerToken = (authorizationHeader = '') => {
  const header = String(authorizationHeader || '');
  if (!header.startsWith('Bearer ')) return '';
  return header.split(' ')[1] || '';
};
