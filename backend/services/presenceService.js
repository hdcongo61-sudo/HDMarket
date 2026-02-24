import { getRedisClient, initRedis, isRedisReady } from '../config/redisClient.js';
import UserSession from '../models/userSessionModel.js';
import PlatformDailyAnalytics from '../models/platformDailyAnalyticsModel.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const ONLINE_USER_KEY = (userId) => `${ENV}:online:user:${String(userId)}`;
const USER_SOCKETS_KEY = (userId) => `${ENV}:online:user:${String(userId)}:sockets`;
const SOCKET_META_KEY = (socketRef) => `${ENV}:online:socket:${String(socketRef)}`;
const ACTIVE_DAY_KEY = (day) => `${ENV}:active:${day}`;
const PEAK_DAY_KEY = (day) => `${ENV}:stats:peak:${day}`;

const ONLINE_USERS_SET_KEY = `${ENV}:online:users`;
const ONLINE_SELLERS_SET_KEY = `${ENV}:online:sellers`;
const ONLINE_ADMINS_SET_KEY = `${ENV}:online:admins`;
const ONLINE_REGULAR_SET_KEY = `${ENV}:online:regular`;

const SOCKET_TTL_SECONDS = Math.max(45, Number(process.env.ONLINE_SOCKET_TTL_SECONDS || 120));
const USER_STATE_TTL_SECONDS = Math.max(300, Number(process.env.ONLINE_USER_STATE_TTL_SECONDS || 3600));
const USER_SOCKET_SET_TTL_SECONDS = Math.max(300, Number(process.env.ONLINE_USER_SOCKET_SET_TTL_SECONDS || 3600));
const ACTIVE_TTL_SECONDS = 48 * 60 * 60;
const PEAK_TTL_SECONDS = 48 * 60 * 60;

const ADMIN_ROLES = new Set(['admin', 'manager', 'founder']);

const fallbackState = {
  userSockets: new Map(),
  socketMeta: new Map(),
  users: new Set(),
  sellers: new Set(),
  admins: new Set(),
  regular: new Set(),
  activeByDay: new Map(),
  peakByDay: new Map()
};

const toDayKey = (date = new Date()) => new Date(date).toISOString().slice(0, 10);

const dayKeyToRange = (dayKey) => {
  const safeKey = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(dayKey || ''))
    ? String(dayKey)
    : toDayKey();
  const start = new Date(`${safeKey}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { safeKey, start, end };
};

const roleBucket = (role = '') => {
  const normalizedRole = String(role || 'user').toLowerCase();
  return ADMIN_ROLES.has(normalizedRole) ? normalizedRole : 'user';
};

const detectDevice = (userAgent = '') => {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/ipad|tablet|sm-t|kindle|playbook/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/macintosh|windows|linux|x11|cros/.test(ua)) return 'desktop';
  return 'unknown';
};

const classifyPresence = ({ role = 'user', accountType = 'person' } = {}) => {
  const normalizedRole = roleBucket(role);
  const normalizedAccountType = String(accountType || 'person').toLowerCase() === 'shop' ? 'shop' : 'person';
  const isAdmin = ADMIN_ROLES.has(normalizedRole);
  const isSeller = !isAdmin && normalizedAccountType === 'shop';
  const isRegular = !isAdmin && !isSeller;
  return {
    normalizedRole,
    normalizedAccountType,
    isAdmin,
    isSeller,
    isRegular
  };
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

const touchFallbackPeak = (dayKey, total) => {
  const current = Number(fallbackState.peakByDay.get(dayKey) || 0);
  if (total > current) {
    fallbackState.peakByDay.set(dayKey, total);
    return total;
  }
  return current;
};

const addFallbackRoles = (userId, classification) => {
  fallbackState.users.add(userId);
  if (classification.isSeller) fallbackState.sellers.add(userId);
  else fallbackState.sellers.delete(userId);
  if (classification.isAdmin) fallbackState.admins.add(userId);
  else fallbackState.admins.delete(userId);
  if (classification.isRegular) fallbackState.regular.add(userId);
  else fallbackState.regular.delete(userId);
};

const removeFallbackRoles = (userId) => {
  fallbackState.users.delete(userId);
  fallbackState.sellers.delete(userId);
  fallbackState.admins.delete(userId);
  fallbackState.regular.delete(userId);
};

const closeSession = async (sessionId, disconnectedAt = new Date()) => {
  if (!sessionId) return;
  try {
    const session = await UserSession.findById(sessionId).select('connectedAt disconnectedAt');
    if (!session || session.disconnectedAt) return;
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(disconnectedAt).getTime() - new Date(session.connectedAt).getTime()) / 1000)
    );
    session.disconnectedAt = disconnectedAt;
    session.durationSeconds = durationSeconds;
    await session.save();
  } catch {
    // Ignore session close errors.
  }
};

const createSession = async ({
  userId,
  role,
  device,
  ip,
  city,
  namespace = '/notifications',
  connectedAt = new Date()
} = {}) => {
  if (!userId) return '';
  try {
    const doc = await UserSession.create({
      userId,
      role,
      connectedAt,
      device,
      ip,
      city,
      namespace
    });
    return String(doc?._id || '');
  } catch {
    return '';
  }
};

export const markUserActive = async (userId, date = new Date()) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return false;
  const dayKey = toDayKey(date);
  const fallbackSet = fallbackState.activeByDay.get(dayKey) || new Set();
  fallbackSet.add(normalizedUserId);
  fallbackState.activeByDay.set(dayKey, fallbackSet);

  const ok = await safeRedis(async (client) => {
    await client.sAdd(ACTIVE_DAY_KEY(dayKey), normalizedUserId);
    await client.expire(ACTIVE_DAY_KEY(dayKey), ACTIVE_TTL_SECONDS);
    return true;
  }, false);
  return Boolean(ok);
};

const updatePeakIfNeeded = async (currentCount, at = new Date()) => {
  const dayKey = toDayKey(at);
  touchFallbackPeak(dayKey, Number(currentCount || 0));

  const nextPeak = await safeRedis(async (client) => {
    const key = PEAK_DAY_KEY(dayKey);
    const current = Number((await client.hGet(key, 'value')) || 0);
    const next = Number(currentCount || 0);
    if (next > current) {
      await client.hSet(key, {
        value: String(next),
        at: new Date(at).toISOString()
      });
      await client.expire(key, PEAK_TTL_SECONDS);
      return next;
    }
    return current;
  }, Number(fallbackState.peakByDay.get(dayKey) || 0));

  return Number(nextPeak || 0);
};

const cleanupUserFromRedis = async (client, userId) => {
  await Promise.all([
    client.del(ONLINE_USER_KEY(userId)),
    client.del(USER_SOCKETS_KEY(userId)),
    client.sRem(ONLINE_USERS_SET_KEY, userId),
    client.sRem(ONLINE_SELLERS_SET_KEY, userId),
    client.sRem(ONLINE_ADMINS_SET_KEY, userId),
    client.sRem(ONLINE_REGULAR_SET_KEY, userId)
  ]);
};

export const registerPresenceConnection = async ({
  userId,
  role = 'user',
  accountType = 'person',
  socketId,
  namespace = '/notifications',
  userAgent = '',
  ip = '',
  city = '',
  connectedAt = new Date()
} = {}) => {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSocketId = String(socketId || '').trim();
  if (!normalizedUserId || !normalizedSocketId) {
    return { socketRef: '', sessionId: '', socketCount: 0 };
  }

  const socketRef = `${String(namespace || '/notifications')}:${normalizedSocketId}`;
  const classification = classifyPresence({ role, accountType });
  const device = detectDevice(userAgent);
  const nowIso = new Date(connectedAt).toISOString();
  const sessionId = await createSession({
    userId: normalizedUserId,
    role: classification.normalizedRole,
    device,
    ip,
    city,
    namespace,
    connectedAt
  });

  await markUserActive(normalizedUserId, connectedAt);

  const socketCount = await safeRedis(async (client) => {
    await client.sAdd(USER_SOCKETS_KEY(normalizedUserId), socketRef);
    await client.expire(USER_SOCKETS_KEY(normalizedUserId), USER_SOCKET_SET_TTL_SECONDS);

    await client.set(
      SOCKET_META_KEY(socketRef),
      JSON.stringify({
        userId: normalizedUserId,
        role: classification.normalizedRole,
        accountType: classification.normalizedAccountType,
        connectedAt: nowIso
      }),
      { EX: SOCKET_TTL_SECONDS }
    );

    await client.hSet(ONLINE_USER_KEY(normalizedUserId), {
      role: classification.normalizedRole,
      accountType: classification.normalizedAccountType,
      city: String(city || ''),
      lastSeen: nowIso
    });
    await client.expire(ONLINE_USER_KEY(normalizedUserId), USER_STATE_TTL_SECONDS);
    await client.sAdd(ONLINE_USERS_SET_KEY, normalizedUserId);

    if (classification.isSeller) await client.sAdd(ONLINE_SELLERS_SET_KEY, normalizedUserId);
    else await client.sRem(ONLINE_SELLERS_SET_KEY, normalizedUserId);

    if (classification.isAdmin) await client.sAdd(ONLINE_ADMINS_SET_KEY, normalizedUserId);
    else await client.sRem(ONLINE_ADMINS_SET_KEY, normalizedUserId);

    if (classification.isRegular) await client.sAdd(ONLINE_REGULAR_SET_KEY, normalizedUserId);
    else await client.sRem(ONLINE_REGULAR_SET_KEY, normalizedUserId);

    const count = Number(await client.sCard(USER_SOCKETS_KEY(normalizedUserId)));
    await client.hSet(ONLINE_USER_KEY(normalizedUserId), {
      socketCount: String(count),
      lastSeen: nowIso
    });

    const totalOnline = Number(await client.sCard(ONLINE_USERS_SET_KEY));
    await updatePeakIfNeeded(totalOnline, connectedAt);
    return count;
  }, null);

  if (socketCount == null) {
    const fallbackSockets = fallbackState.userSockets.get(normalizedUserId) || new Set();
    fallbackSockets.add(socketRef);
    fallbackState.userSockets.set(normalizedUserId, fallbackSockets);
    fallbackState.socketMeta.set(socketRef, {
      userId: normalizedUserId,
      role: classification.normalizedRole,
      accountType: classification.normalizedAccountType,
      connectedAt: nowIso
    });
    addFallbackRoles(normalizedUserId, classification);
    touchFallbackPeak(toDayKey(connectedAt), fallbackState.users.size);
    return { socketRef, sessionId, socketCount: fallbackSockets.size };
  }

  return { socketRef, sessionId, socketCount: Number(socketCount || 0) };
};

export const touchPresenceConnection = async ({
  userId,
  socketId,
  namespace = '/notifications',
  role = 'user',
  accountType = 'person'
} = {}) => {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSocketId = String(socketId || '').trim();
  if (!normalizedUserId || !normalizedSocketId) return false;
  const socketRef = `${String(namespace || '/notifications')}:${normalizedSocketId}`;
  const classification = classifyPresence({ role, accountType });
  const now = new Date();
  const nowIso = now.toISOString();

  await markUserActive(normalizedUserId, now);

  const touched = await safeRedis(async (client) => {
    await client.expire(USER_SOCKETS_KEY(normalizedUserId), USER_SOCKET_SET_TTL_SECONDS);
    await client.set(
      SOCKET_META_KEY(socketRef),
      JSON.stringify({
        userId: normalizedUserId,
        role: classification.normalizedRole,
        accountType: classification.normalizedAccountType,
        touchedAt: nowIso
      }),
      { EX: SOCKET_TTL_SECONDS }
    );
    await client.hSet(ONLINE_USER_KEY(normalizedUserId), {
      lastSeen: nowIso
    });
    await client.expire(ONLINE_USER_KEY(normalizedUserId), USER_STATE_TTL_SECONDS);
    return true;
  }, false);

  if (!touched) {
    const meta = fallbackState.socketMeta.get(socketRef);
    if (meta) {
      fallbackState.socketMeta.set(socketRef, { ...meta, touchedAt: nowIso });
    }
  }

  return Boolean(touched);
};

export const unregisterPresenceConnection = async ({
  userId,
  socketId,
  namespace = '/notifications',
  sessionId = '',
  disconnectedAt = new Date()
} = {}) => {
  const normalizedUserId = String(userId || '').trim();
  const normalizedSocketId = String(socketId || '').trim();
  if (!normalizedUserId || !normalizedSocketId) {
    await closeSession(sessionId, disconnectedAt);
    return { socketCount: 0 };
  }
  const socketRef = `${String(namespace || '/notifications')}:${normalizedSocketId}`;

  const socketCount = await safeRedis(async (client) => {
    await client.sRem(USER_SOCKETS_KEY(normalizedUserId), socketRef);
    await client.del(SOCKET_META_KEY(socketRef));

    const count = Number(await client.sCard(USER_SOCKETS_KEY(normalizedUserId)));
    if (count <= 0) {
      await cleanupUserFromRedis(client, normalizedUserId);
    } else {
      await client.hSet(ONLINE_USER_KEY(normalizedUserId), {
        socketCount: String(count),
        lastSeen: new Date(disconnectedAt).toISOString()
      });
      await client.expire(ONLINE_USER_KEY(normalizedUserId), USER_STATE_TTL_SECONDS);
      await client.expire(USER_SOCKETS_KEY(normalizedUserId), USER_SOCKET_SET_TTL_SECONDS);
    }
    const totalOnline = Number(await client.sCard(ONLINE_USERS_SET_KEY));
    await updatePeakIfNeeded(totalOnline, disconnectedAt);
    return count;
  }, null);

  if (socketCount == null) {
    const sockets = fallbackState.userSockets.get(normalizedUserId) || new Set();
    sockets.delete(socketRef);
    fallbackState.socketMeta.delete(socketRef);
    if (!sockets.size) {
      fallbackState.userSockets.delete(normalizedUserId);
      removeFallbackRoles(normalizedUserId);
    } else {
      fallbackState.userSockets.set(normalizedUserId, sockets);
    }
    touchFallbackPeak(toDayKey(disconnectedAt), fallbackState.users.size);
  }

  await closeSession(sessionId, disconnectedAt);
  return { socketCount: Number(socketCount || 0) };
};

export const sweepStalePresenceSockets = async () => {
  return safeRedis(async (client) => {
    const userIds = await client.sMembers(ONLINE_USERS_SET_KEY);
    let removedUsers = 0;
    let removedSockets = 0;

    for (const userId of userIds) {
      const socketRefs = await client.sMembers(USER_SOCKETS_KEY(userId));
      if (!socketRefs.length) {
        await cleanupUserFromRedis(client, userId);
        removedUsers += 1;
        continue;
      }

      const stale = [];
      for (const socketRef of socketRefs) {
        const exists = Number(await client.exists(SOCKET_META_KEY(socketRef)));
        if (!exists) stale.push(socketRef);
      }

      if (stale.length) {
        await client.sRem(USER_SOCKETS_KEY(userId), ...stale);
        removedSockets += stale.length;
      }

      const nextCount = Number(await client.sCard(USER_SOCKETS_KEY(userId)));
      if (nextCount <= 0) {
        await cleanupUserFromRedis(client, userId);
        removedUsers += 1;
      } else {
        await client.hSet(ONLINE_USER_KEY(userId), { socketCount: String(nextCount) });
        await client.expire(ONLINE_USER_KEY(userId), USER_STATE_TTL_SECONDS);
        await client.expire(USER_SOCKETS_KEY(userId), USER_SOCKET_SET_TTL_SECONDS);
      }
    }

    return {
      removedUsers,
      removedSockets,
      totalOnline: Number(await client.sCard(ONLINE_USERS_SET_KEY))
    };
  }, { removedUsers: 0, removedSockets: 0, totalOnline: fallbackState.users.size });
};

const getPeakForDay = async (dayKey = toDayKey()) => {
  const fallbackPeak = Number(fallbackState.peakByDay.get(dayKey) || 0);
  return safeRedis(async (client) => {
    const raw = await client.hGetAll(PEAK_DAY_KEY(dayKey));
    return {
      value: Number(raw?.value || 0),
      at: raw?.at || null
    };
  }, { value: fallbackPeak, at: null });
};

const getActiveUsersForDay = async (dayKey = toDayKey()) => {
  const fallbackSet = fallbackState.activeByDay.get(dayKey);
  return safeRedis(
    async (client) => Number(await client.sCard(ACTIVE_DAY_KEY(dayKey))),
    fallbackSet ? fallbackSet.size : 0
  );
};

const getRollingActiveUsers = async (days = 7, endDayKey = toDayKey()) => {
  const { start: endDate } = dayKeyToRange(endDayKey);
  const keys = [];
  for (let i = 0; i < Math.max(1, Number(days || 1)); i += 1) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(ACTIVE_DAY_KEY(toDayKey(d)));
  }

  return safeRedis(async (client) => {
    if (!keys.length) return 0;
    if (typeof client.sUnion === 'function') {
      const members = await client.sUnion(keys);
      return Array.isArray(members) ? members.length : 0;
    }
    const merged = new Set();
    for (const key of keys) {
      const members = await client.sMembers(key);
      members.forEach((member) => merged.add(member));
    }
    return merged.size;
  }, 0);
};

export const getOnlineStatsSnapshot = async () => {
  const dayKey = toDayKey();
  const redisStats = await safeRedis(async (client) => {
    const [totalOnline, sellersOnline, adminsOnline, regularOnline] = await Promise.all([
      client.sCard(ONLINE_USERS_SET_KEY),
      client.sCard(ONLINE_SELLERS_SET_KEY),
      client.sCard(ONLINE_ADMINS_SET_KEY),
      client.sCard(ONLINE_REGULAR_SET_KEY)
    ]);
    return {
      totalOnline: Number(totalOnline || 0),
      sellersOnline: Number(sellersOnline || 0),
      adminsOnline: Number(adminsOnline || 0),
      regularOnline: Number(regularOnline || 0)
    };
  }, null);

  const fallbackStats = {
    totalOnline: fallbackState.users.size,
    sellersOnline: fallbackState.sellers.size,
    adminsOnline: fallbackState.admins.size,
    regularOnline: fallbackState.regular.size
  };

  const counts = redisStats || fallbackStats;
  const usersOnline = counts.regularOnline > 0
    ? counts.regularOnline
    : Math.max(0, counts.totalOnline - counts.sellersOnline - counts.adminsOnline);
  const [dau, wau, peak] = await Promise.all([
    getActiveUsersForDay(dayKey),
    getRollingActiveUsers(7, dayKey),
    getPeakForDay(dayKey)
  ]);

  return {
    day: dayKey,
    totalOnline: counts.totalOnline,
    usersOnline,
    sellersOnline: counts.sellersOnline,
    adminsOnline: counts.adminsOnline,
    dau: Number(dau || 0),
    wau: Number(wau || 0),
    peakToday: Number(peak?.value || 0),
    peakAt: peak?.at || null,
    updatedAt: new Date().toISOString()
  };
};

export const runPresencePeakSnapshot = async () => {
  const sweep = await sweepStalePresenceSockets();
  const stats = await getOnlineStatsSnapshot();
  await updatePeakIfNeeded(stats.totalOnline, new Date());
  return {
    ...stats,
    sweep
  };
};

export const aggregateDailyPresenceAnalytics = async ({ dayKey = toDayKey() } = {}) => {
  const { safeKey, start, end } = dayKeyToRange(dayKey);
  const [dau, wau, peak, sessionSummary, deviceSummary, citySummary, hourSummary] = await Promise.all([
    getActiveUsersForDay(safeKey),
    getRollingActiveUsers(7, safeKey),
    getPeakForDay(safeKey),
    UserSession.aggregate([
      {
        $match: {
          connectedAt: { $gte: start, $lt: end },
          disconnectedAt: { $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          sessionsCount: { $sum: 1 },
          avgDurationSeconds: { $avg: '$durationSeconds' }
        }
      }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$device', count: { $sum: 1 } } }
    ]),
    UserSession.aggregate([
      {
        $match: {
          connectedAt: { $gte: start, $lt: end },
          city: { $exists: true, $ne: '' }
        }
      },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    UserSession.aggregate([
      { $match: { connectedAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $hour: '$connectedAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const sessionData = sessionSummary?.[0] || {};
  const devices = {
    mobile: 0,
    tablet: 0,
    desktop: 0,
    unknown: 0
  };
  deviceSummary.forEach((entry) => {
    const key = ['mobile', 'tablet', 'desktop', 'unknown'].includes(entry?._id)
      ? entry._id
      : 'unknown';
    devices[key] = Number(entry?.count || 0);
  });

  const hourlyMap = new Map(hourSummary.map((entry) => [Number(entry?._id), Number(entry?.count || 0)]));
  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyMap.get(hour) || 0
  }));

  const topCities = citySummary.map((entry) => ({
    city: String(entry?._id || ''),
    count: Number(entry?.count || 0)
  }));

  const payload = {
    day: safeKey,
    date: start,
    dau: Number(dau || 0),
    wau: Number(wau || 0),
    peakConcurrent: Number(peak?.value || 0),
    avgSessionDurationSeconds: Number(sessionData?.avgDurationSeconds || 0),
    sessionsCount: Number(sessionData?.sessionsCount || 0),
    deviceDistribution: devices,
    topCities,
    hourlyActivity,
    generatedAt: new Date()
  };

  await PlatformDailyAnalytics.updateOne({ day: safeKey }, { $set: payload }, { upsert: true });
  return payload;
};

export const getPresenceConstants = () => ({
  env: ENV,
  keys: {
    onlineUsers: ONLINE_USERS_SET_KEY,
    onlineSellers: ONLINE_SELLERS_SET_KEY,
    onlineAdmins: ONLINE_ADMINS_SET_KEY
  }
});
