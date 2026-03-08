import crypto from 'crypto';
import { getRedisClient, initRedis, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const EVENT_STREAM_KEY = `${ENV}:realtime:monitoring:events`;
const MAX_STREAM_SIZE = Math.max(500, Number(process.env.REALTIME_MONITOR_STREAM_SIZE || 5000));
const STREAM_TTL_SECONDS = Math.max(
  600,
  Number(process.env.REALTIME_MONITOR_STREAM_TTL_SECONDS || 6 * 60 * 60)
);

const KNOWN_EVENT_TYPES = new Set([
  'page_view',
  'like',
  'comment',
  'order',
  'delivery',
  'payment',
  'message',
  'image_preview_open',
  'image_preview_zoom',
  'image_preview_share',
  'image_preview_download',
  'image_preview_report',
  'other'
]);

const memoryFallback = {
  events: []
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const safeRedis = async (fn, fallback = null) => {
  try {
    const client = await ensureRedis();
    if (!client) return fallback;
    return await fn(client);
  } catch {
    return fallback;
  }
};

const cleanValue = (value, maxLength = 120) => String(value || '').trim().slice(0, maxLength);

const normalizeEventType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'favorite' || normalized === 'favorites') return 'like';
  if (normalized === 'product_comment') return 'comment';
  if (KNOWN_EVENT_TYPES.has(normalized)) return normalized;
  return 'other';
};

const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  if (['admin', 'founder', 'manager', 'user', 'delivery_guy', 'delivery'].includes(role)) return role;
  return role ? role.slice(0, 32) : 'guest';
};

const normalizeAccountType = (value) => {
  const accountType = String(value || '').trim().toLowerCase();
  if (accountType === 'shop') return 'shop';
  if (accountType === 'person') return 'person';
  return accountType ? accountType.slice(0, 32) : 'unknown';
};

const isDynamicSegment = (segment = '') => {
  if (!segment) return false;
  if (/^[0-9]+$/.test(segment)) return true;
  if (/^[a-f0-9]{24}$/i.test(segment)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(segment))
    return true;
  return false;
};

export const normalizeMonitoringPath = (input = '') => {
  let value = String(input || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      value = parsed.pathname || '/';
    } catch {
      // Ignore URL parse errors and keep original value.
    }
  }

  const noHash = value.split('#')[0] || '';
  const noQuery = noHash.split('?')[0] || '';
  let path = noQuery.trim();
  if (!path) return '';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/g, '');

  const normalizedParts = path
    .split('/')
    .filter((part, index) => index === 0 || part.length > 0)
    .map((part) => {
      if (part === '') return '';
      let decoded = part;
      try {
        decoded = decodeURIComponent(part);
      } catch {
        decoded = part;
      }
      if (isDynamicSegment(decoded)) return ':id';
      return cleanValue(decoded, 64);
    });

  const normalized = normalizedParts.join('/') || '/';
  return cleanValue(normalized, 180);
};

const buildEventId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
};

const pushMemoryEvent = (event) => {
  memoryFallback.events.unshift(event);
  if (memoryFallback.events.length > MAX_STREAM_SIZE) {
    memoryFallback.events.length = MAX_STREAM_SIZE;
  }
};

const parseRawEvents = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      try {
        const parsed = JSON.parse(item);
        const ts = Number(parsed?.ts || Date.parse(parsed?.createdAt || ''));
        if (!Number.isFinite(ts) || ts <= 0) return null;
        return {
          id: cleanValue(parsed?.id, 64),
          eventType: normalizeEventType(parsed?.eventType),
          path: normalizeMonitoringPath(parsed?.path || ''),
          role: normalizeRole(parsed?.role),
          accountType: normalizeAccountType(parsed?.accountType),
          entityType: cleanValue(parsed?.entityType, 40),
          entityId: cleanValue(parsed?.entityId, 80),
          visitorId: cleanValue(parsed?.visitorId, 80),
          ts,
          createdAt: new Date(ts).toISOString()
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const minuteBucket = (timestampMs) => {
  const date = new Date(timestampMs);
  date.setSeconds(0, 0);
  return date.getTime();
};

const buildTimeline = ({ events = [], windowMinutes = 60 }) => {
  const now = Date.now();
  const limit = Math.max(5, Math.min(180, Number(windowMinutes || 60)));
  const cutoff = now - limit * 60_000;
  const minuteMap = new Map();

  events.forEach((event) => {
    if (event.ts < cutoff) return;
    const key = minuteBucket(event.ts);
    const current = minuteMap.get(key) || {
      minuteTs: key,
      minute: new Date(key).toISOString(),
      label: new Date(key).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      pageViews: 0,
      likes: 0,
      comments: 0,
      previewOpens: 0,
      previewInteractions: 0,
      total: 0
    };
    if (event.eventType === 'page_view') current.pageViews += 1;
    if (event.eventType === 'like') current.likes += 1;
    if (event.eventType === 'comment') current.comments += 1;
    if (event.eventType === 'image_preview_open') current.previewOpens += 1;
    if (event.eventType.startsWith('image_preview_') && event.eventType !== 'image_preview_open') {
      current.previewInteractions += 1;
    }
    current.total += 1;
    minuteMap.set(key, current);
  });

  const timeline = [];
  for (let index = limit - 1; index >= 0; index -= 1) {
    const key = minuteBucket(now - index * 60_000);
    const fallback = {
      minuteTs: key,
      minute: new Date(key).toISOString(),
      label: new Date(key).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      pageViews: 0,
      likes: 0,
      comments: 0,
      previewOpens: 0,
      previewInteractions: 0,
      total: 0
    };
    timeline.push(minuteMap.get(key) || fallback);
  }

  return timeline;
};

const aggregateSnapshot = ({ events = [], windowMinutes = 60, topLimit = 8, recentLimit = 20 }) => {
  const now = Date.now();
  const safeWindowMinutes = Math.max(5, Math.min(180, Number(windowMinutes || 60)));
  const cutoff = now - safeWindowMinutes * 60_000;
  const filtered = events.filter((event) => Number(event.ts || 0) >= cutoff);

  let pageViews = 0;
  let likes = 0;
  let comments = 0;
  let previewOpens = 0;
  let previewInteractions = 0;

  const pageMap = new Map();
  const typeMap = new Map();
  const visitorSet = new Set();

  filtered.forEach((event) => {
    const eventType = normalizeEventType(event.eventType);
    typeMap.set(eventType, Number(typeMap.get(eventType) || 0) + 1);

    if (eventType === 'page_view') {
      pageViews += 1;
      const path = normalizeMonitoringPath(event.path || '') || '/';
      pageMap.set(path, Number(pageMap.get(path) || 0) + 1);
    } else if (eventType === 'like') {
      likes += 1;
    } else if (eventType === 'comment') {
      comments += 1;
    } else if (eventType === 'image_preview_open') {
      previewOpens += 1;
    } else if (eventType.startsWith('image_preview_')) {
      previewInteractions += 1;
    }

    if (event.visitorId) visitorSet.add(event.visitorId);
  });

  const topPages = Array.from(pageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, Math.min(20, Number(topLimit || 8))))
    .map(([path, views]) => ({ path, views: Number(views || 0) }));

  const breakdown = Array.from(typeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count: Number(count || 0) }));

  const recentEvents = filtered
    .slice(0, Math.max(1, Math.min(40, Number(recentLimit || 20))))
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      path: event.path || '',
      role: event.role || 'guest',
      accountType: event.accountType || 'unknown',
      entityType: event.entityType || '',
      entityId: event.entityId || '',
      createdAt: event.createdAt
    }));

  const timeline = buildTimeline({ events: filtered, windowMinutes: safeWindowMinutes });

  return {
    windowMinutes: safeWindowMinutes,
    totals: {
      events: filtered.length,
      pageViews,
      likes,
      comments,
      previewOpens,
      previewInteractions,
      uniqueVisitors: visitorSet.size
    },
    topPages,
    breakdown,
    timeline,
    recentEvents,
    updatedAt: new Date().toISOString()
  };
};

export const recordRealtimeMonitoringEvent = async (payload = {}) => {
  const now = Date.now();
  const eventType = normalizeEventType(payload.eventType);
  const path = normalizeMonitoringPath(payload.path || '');
  const event = {
    id: buildEventId(),
    eventType,
    path: path || (eventType === 'page_view' ? '/' : ''),
    role: normalizeRole(payload.role),
    accountType: normalizeAccountType(payload.accountType),
    entityType: cleanValue(payload.entityType, 40),
    entityId: cleanValue(payload.entityId, 80),
    visitorId: cleanValue(payload.visitorId, 80),
    ts: now,
    createdAt: new Date(now).toISOString()
  };

  const writeOk = await safeRedis(async (client) => {
    await client.lPush(EVENT_STREAM_KEY, JSON.stringify(event));
    await client.lTrim(EVENT_STREAM_KEY, 0, MAX_STREAM_SIZE - 1);
    await client.expire(EVENT_STREAM_KEY, STREAM_TTL_SECONDS);
    return true;
  }, false);

  if (!writeOk) {
    pushMemoryEvent(event);
  }

  return event;
};

export const getRealtimeMonitoringSnapshot = async ({
  windowMinutes = 60,
  topLimit = 8,
  recentLimit = 20
} = {}) => {
  const redisEvents = await safeRedis(
    async (client) => {
      const raw = await client.lRange(EVENT_STREAM_KEY, 0, MAX_STREAM_SIZE - 1);
      return parseRawEvents(raw);
    },
    null
  );

  const source = Array.isArray(redisEvents) ? redisEvents : memoryFallback.events.slice(0, MAX_STREAM_SIZE);
  const parsed = Array.isArray(redisEvents) ? redisEvents : parseRawEvents(source.map((item) => JSON.stringify(item)));

  return aggregateSnapshot({
    events: parsed,
    windowMinutes,
    topLimit,
    recentLimit
  });
};

export default {
  recordRealtimeMonitoringEvent,
  getRealtimeMonitoringSnapshot,
  normalizeMonitoringPath
};
