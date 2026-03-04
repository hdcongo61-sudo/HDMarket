import Notification from '../models/notificationModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';

const ENV = String(process.env.CACHE_ENV || process.env.NODE_ENV || 'dev')
  .toLowerCase()
  .startsWith('prod')
  ? 'prod'
  : 'dev';

const TASK_COUNTER_TTL_SECONDS = Math.max(
  30,
  Number(process.env.NOTIFICATION_TASK_COUNTER_TTL_SECONDS || 120)
);

export const VALIDATION_TASK_TYPES = Object.freeze([
  'boostApproval',
  'productValidation',
  'shopVerification',
  'deliveryOps',
  'disputes',
  'refunds',
  'shopConversion',
  'sponsoredAds',
  'other'
]);

const withRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const normalizeRole = (value = '') => String(value || '').trim().toLowerCase();

export const normalizeValidationTaskType = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'other';
  if (VALIDATION_TASK_TYPES.includes(normalized)) return normalized;
  return 'other';
};

const buildAdminPendingKey = () => `${ENV}:tasks:admin:pending`;
const buildFounderPendingKey = () => `${ENV}:tasks:founder:pending`;
const buildRolePendingKey = (role) => `${ENV}:tasks:role:${normalizeRole(role)}:pending`;
const buildAdminTypePendingKey = (type) =>
  `${ENV}:tasks:admin:pending:type:${normalizeValidationTaskType(type)}`;
const buildFounderTypePendingKey = (type) =>
  `${ENV}:tasks:founder:pending:type:${normalizeValidationTaskType(type)}`;

const clampNumber = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
};

const readCounter = async (client, key) => {
  const value = await client.get(key);
  if (value === null) return null;
  return clampNumber(value);
};

const setCounter = async (client, key, value) => {
  await client.set(key, String(clampNumber(value)), { EX: TASK_COUNTER_TTL_SECONDS });
};

const incrCounter = async (client, key, delta) => {
  const safeDelta = Math.max(1, Number(delta || 1));
  const next = await client.incrBy(key, safeDelta);
  await client.expire(key, TASK_COUNTER_TTL_SECONDS);
  return clampNumber(next);
};

const decrCounter = async (client, key, delta) => {
  const safeDelta = Math.max(1, Number(delta || 1));
  const next = await client.decrBy(key, safeDelta);
  const safeValue = clampNumber(next);
  await setCounter(client, key, safeValue);
  return safeValue;
};

const buildRoleTaskFilter = (role = '') => {
  const normalizedRole = normalizeRole(role);
  const upperRole = normalizedRole.toUpperCase();
  const base = {
    actionRequired: true,
    actionStatus: 'PENDING'
  };
  if (!normalizedRole) return base;

  if (normalizedRole === 'admin' || normalizedRole === 'founder') {
    return {
      ...base,
      $or: [
        { audience: upperRole },
        { audience: 'ROLE_GROUP', targetRole: { $in: [upperRole, normalizedRole] } }
      ]
    };
  }

  return {
    ...base,
    audience: 'ROLE_GROUP',
    targetRole: { $in: [upperRole, normalizedRole] }
  };
};

const getRoleAggregateCounts = async (role = '') => {
  const roleFilter = buildRoleTaskFilter(role);
  const rows = await Notification.aggregate([
    { $match: roleFilter },
    {
      $group: {
        _id: '$validationType',
        count: { $sum: 1 }
      }
    }
  ]);

  const counts = VALIDATION_TASK_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    const key = normalizeValidationTaskType(row?._id || 'other');
    counts[key] = clampNumber(row?.count || 0);
  });

  return counts;
};

export const syncTaskCountersForRole = async (role = '') => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const client = await withRedis();
  if (!client) return null;

  const counts = await getRoleAggregateCounts(normalizedRole);
  const pendingTotal = Object.values(counts).reduce((sum, value) => sum + clampNumber(value), 0);

  await setCounter(client, buildRolePendingKey(normalizedRole), pendingTotal);
  if (normalizedRole === 'admin') {
    await setCounter(client, buildAdminPendingKey(), pendingTotal);
  }
  if (normalizedRole === 'founder') {
    await setCounter(client, buildFounderPendingKey(), pendingTotal);
  }

  await Promise.all(
    VALIDATION_TASK_TYPES.map(async (type) => {
      const value = clampNumber(counts[type] || 0);
      if (normalizedRole === 'admin') {
        await setCounter(client, buildAdminTypePendingKey(type), value);
      } else if (normalizedRole === 'founder') {
        await setCounter(client, buildFounderTypePendingKey(type), value);
      }
    })
  );

  return { pendingTotal, pendingByType: counts };
};

export const deriveTaskRolesFromNotification = (notification = {}) => {
  const audience = String(notification?.audience || '').trim().toUpperCase();
  const targetRoles = Array.isArray(notification?.targetRole)
    ? notification.targetRole.map((role) => normalizeRole(role)).filter(Boolean)
    : [];
  const roles = new Set();

  if (audience === 'ADMIN') roles.add('admin');
  if (audience === 'FOUNDER') roles.add('founder');
  if (audience === 'ROLE_GROUP') {
    targetRoles.forEach((role) => roles.add(role));
  }

  return Array.from(roles);
};

const adjustRoleTaskCounters = async ({ roles = [], type = 'other', delta = 1, direction = 'incr' }) => {
  const normalizedType = normalizeValidationTaskType(type);
  const uniqueRoles = Array.from(new Set((roles || []).map((role) => normalizeRole(role)).filter(Boolean)));
  if (!uniqueRoles.length) return;
  const client = await withRedis();
  if (!client) return;

  await Promise.all(
    uniqueRoles.map(async (role) => {
      if (direction === 'incr') {
        await incrCounter(client, buildRolePendingKey(role), delta);
      } else {
        await decrCounter(client, buildRolePendingKey(role), delta);
      }

      if (role === 'admin') {
        if (direction === 'incr') {
          await incrCounter(client, buildAdminPendingKey(), delta);
          await incrCounter(client, buildAdminTypePendingKey(normalizedType), delta);
        } else {
          await decrCounter(client, buildAdminPendingKey(), delta);
          await decrCounter(client, buildAdminTypePendingKey(normalizedType), delta);
        }
      }

      if (role === 'founder') {
        if (direction === 'incr') {
          await incrCounter(client, buildFounderPendingKey(), delta);
          await incrCounter(client, buildFounderTypePendingKey(normalizedType), delta);
        } else {
          await decrCounter(client, buildFounderPendingKey(), delta);
          await decrCounter(client, buildFounderTypePendingKey(normalizedType), delta);
        }
      }
    })
  );
};

export const incrementTaskCounters = async ({ roles = [], type = 'other', delta = 1 } = {}) =>
  adjustRoleTaskCounters({ roles, type, delta, direction: 'incr' });

export const decrementTaskCounters = async ({ roles = [], type = 'other', delta = 1 } = {}) =>
  adjustRoleTaskCounters({ roles, type, delta, direction: 'decr' });

export const getTaskSummaryForRole = async (role = '') => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return {
      pendingTotal: 0,
      pendingByType: VALIDATION_TASK_TYPES.reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {}),
      urgentCount: 0,
      overdueCount: 0
    };
  }

  const defaultByType = VALIDATION_TASK_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});

  const client = await withRedis();
  let pendingTotal = null;
  const pendingByType = { ...defaultByType };

  if (client) {
    if (normalizedRole === 'admin') {
      pendingTotal = await readCounter(client, buildAdminPendingKey());
      for (const type of VALIDATION_TASK_TYPES) {
        const cached = await readCounter(client, buildAdminTypePendingKey(type));
        if (cached !== null) pendingByType[type] = cached;
      }
    } else if (normalizedRole === 'founder') {
      pendingTotal = await readCounter(client, buildFounderPendingKey());
      for (const type of VALIDATION_TASK_TYPES) {
        const cached = await readCounter(client, buildFounderTypePendingKey(type));
        if (cached !== null) pendingByType[type] = cached;
      }
    } else {
      pendingTotal = await readCounter(client, buildRolePendingKey(normalizedRole));
    }
  }

  if (pendingTotal === null) {
    const synced = await syncTaskCountersForRole(normalizedRole);
    pendingTotal = clampNumber(synced?.pendingTotal || 0);
    if (synced?.pendingByType) {
      Object.assign(pendingByType, synced.pendingByType);
    }
  } else {
    const typeSum = Object.values(pendingByType).reduce((sum, value) => sum + clampNumber(value), 0);
    if (clampNumber(pendingTotal) > 0 && typeSum === 0) {
      const synced = await syncTaskCountersForRole(normalizedRole);
      if (synced?.pendingByType) {
        Object.assign(pendingByType, synced.pendingByType);
      }
      pendingTotal = clampNumber(synced?.pendingTotal || pendingTotal);
    }
  }

  const roleFilter = buildRoleTaskFilter(normalizedRole);
  const now = new Date();
  const [urgentCount, overdueCount] = await Promise.all([
    Notification.countDocuments({
      ...roleFilter,
      priority: { $in: ['HIGH', 'CRITICAL'] }
    }),
    Notification.countDocuments({
      ...roleFilter,
      actionDueAt: { $ne: null, $lt: now }
    })
  ]);

  return {
    pendingTotal: clampNumber(pendingTotal || 0),
    pendingByType,
    urgentCount: clampNumber(urgentCount || 0),
    overdueCount: clampNumber(overdueCount || 0)
  };
};
