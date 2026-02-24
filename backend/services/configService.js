import AppSetting from '../models/appSettingModel.js';
import FeatureFlag from '../models/featureFlagModel.js';
import { initRedis, getRedisClient, isRedisReady } from '../config/redisClient.js';
import {
  FEATURE_FLAG_DEFAULTS,
  RUNTIME_SETTING_ALIASES,
  RUNTIME_SETTING_LEGACY_MIRRORS,
  RUNTIME_SETTINGS_CATALOG,
  coerceSettingValue,
  getRuntimeSettingMetadata,
  normalizeConfigEnvironment,
  validateSettingValue
} from '../config/runtimeSettingsCatalog.js';

const CACHE_PREFIX = 'hdmarket:config:';
const CACHE_TTL_SECONDS = Math.max(15, Number(process.env.CONFIG_CACHE_TTL_SECONDS || 120));
const HOT_CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

const inMemoryCache = new Map();

const now = () => Date.now();

const normalizeEnv = (environment = undefined) => {
  const requested = environment ?? process.env.APP_CONFIG_ENV ?? process.env.NODE_ENV ?? 'all';
  return normalizeConfigEnvironment(requested);
};

const makeScopedStorageKey = (key, environment = 'all') => {
  const env = normalizeEnv(environment);
  if (env === 'all') return key;
  return `${env}:${key}`;
};

const makeCacheKey = ({ type = 'setting', environment = 'all', key = '' }) => {
  const env = normalizeEnv(environment);
  return `${CACHE_PREFIX}${type}:${env}:${String(key || '').trim()}`;
};

const getHot = (cacheKey) => {
  const item = inMemoryCache.get(cacheKey);
  if (!item) return null;
  if (item.expiresAt <= now()) {
    inMemoryCache.delete(cacheKey);
    return null;
  }
  return item.value;
};

const setHot = (cacheKey, value, ttlMs = HOT_CACHE_TTL_MS) => {
  inMemoryCache.set(cacheKey, {
    value,
    expiresAt: now() + Math.max(1000, Number(ttlMs || HOT_CACHE_TTL_MS))
  });
  return value;
};

const ensureRedis = async () => {
  if (isRedisReady()) return getRedisClient();
  return initRedis();
};

const getRedisValue = async (cacheKey) => {
  try {
    const redis = await ensureRedis();
    if (!redis) return null;
    const raw = await redis.get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setRedisValue = async (cacheKey, value, ttlSeconds = CACHE_TTL_SECONDS) => {
  try {
    const redis = await ensureRedis();
    if (!redis) return false;
    await redis.set(cacheKey, JSON.stringify(value), {
      EX: Math.max(1, Number(ttlSeconds || CACHE_TTL_SECONDS))
    });
    return true;
  } catch {
    return false;
  }
};

const deleteRedisByPattern = async (pattern) => {
  try {
    const redis = await ensureRedis();
    if (!redis || !pattern) return 0;

    let cursor = '0';
    let deleted = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: 200
      });
      const nextCursor = result?.cursor ?? result?.[0] ?? '0';
      const keys = result?.keys ?? result?.[1] ?? [];
      if (Array.isArray(keys) && keys.length) {
        deleted += Number(await redis.del(keys));
      }
      cursor = nextCursor;
    } while (cursor !== '0');

    return deleted;
  } catch {
    return 0;
  }
};

const inferValueType = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'json';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
};

const resolveAliasKey = (key) => {
  const cleaned = String(key || '').trim();
  if (!cleaned) return '';
  return RUNTIME_SETTING_ALIASES[cleaned] || cleaned;
};

const buildSettingResponse = ({ key, value, environment = 'all' }) => {
  const metadata = getRuntimeSettingMetadata(key) || getRuntimeSettingMetadata(resolveAliasKey(key)) || {};
  return {
    key,
    value,
    environment: normalizeEnv(environment),
    category: metadata.category || 'general',
    description: metadata.description || '',
    valueType: metadata.valueType || inferValueType(value),
    isPublic: metadata.isPublic === true,
    hidden: metadata.hidden === true
  };
};

const fetchSettingFromDb = async ({ key, environment = 'all' }) => {
  const canonicalKey = resolveAliasKey(key);
  const env = normalizeEnv(environment);

  const primaryScopedKey = makeScopedStorageKey(canonicalKey, env);
  const fallbackScopedKey = makeScopedStorageKey(canonicalKey, 'all');
  const legacyMirrorKey = RUNTIME_SETTING_LEGACY_MIRRORS[canonicalKey] || String(key || '').trim();

  const candidates = [primaryScopedKey, fallbackScopedKey, canonicalKey, legacyMirrorKey].filter(Boolean);
  const docs = await AppSetting.find({ key: { $in: candidates } })
    .sort({ updatedAt: -1 })
    .lean();

  const byKey = new Map(docs.map((entry) => [entry.key, entry]));
  return (
    byKey.get(primaryScopedKey) ||
    byKey.get(fallbackScopedKey) ||
    byKey.get(canonicalKey) ||
    byKey.get(legacyMirrorKey) ||
    null
  );
};

export const getRuntimeConfig = async (key, options = {}) => {
  const canonicalKey = resolveAliasKey(key);
  if (!canonicalKey) return options.fallback ?? null;

  const env = normalizeEnv(options.environment);
  const cacheKey = makeCacheKey({ type: 'setting', environment: env, key: canonicalKey });

  const hot = getHot(cacheKey);
  if (hot !== null) return hot;

  const redisValue = await getRedisValue(cacheKey);
  if (redisValue !== null) {
    return setHot(cacheKey, redisValue);
  }

  const record = await fetchSettingFromDb({ key: canonicalKey, environment: env });
  const metadata = getRuntimeSettingMetadata(canonicalKey);
  const fallbackFromCatalog = metadata ? metadata.defaultValue : undefined;
  const fallback =
    options.fallback !== undefined ? options.fallback : fallbackFromCatalog !== undefined ? fallbackFromCatalog : null;
  const rawValue = record?.value ?? fallback;
  const value = metadata ? coerceSettingValue(canonicalKey, rawValue) : rawValue;

  setHot(cacheKey, value);
  void setRedisValue(cacheKey, value);

  return value;
};

export const getManyRuntimeConfigs = async (keys = [], options = {}) => {
  const uniqueKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).map(resolveAliasKey).filter(Boolean)));
  if (!uniqueKeys.length) return {};

  const entries = await Promise.all(
    uniqueKeys.map(async (key) => {
      const value = await getRuntimeConfig(key, options);
      return [key, value];
    })
  );

  return Object.fromEntries(entries);
};

export const setRuntimeConfig = async (key, value, options = {}) => {
  const canonicalKey = resolveAliasKey(key);
  if (!canonicalKey) {
    throw new Error('Invalid config key');
  }

  const validation = validateSettingValue(canonicalKey, value);
  if (!validation.ok) {
    const error = new Error(validation.message || 'Validation failed');
    error.statusCode = 400;
    throw error;
  }

  const metadata = validation.metadata || getRuntimeSettingMetadata(canonicalKey) || {};
  const env = normalizeEnv(options.environment);
  const actorId = options.updatedBy || null;
  const storageKey = makeScopedStorageKey(canonicalKey, env);

  const payload = {
    key: storageKey,
    baseKey: canonicalKey,
    value: validation.value,
    valueType: metadata.valueType || inferValueType(validation.value),
    category: metadata.category || 'general',
    description: options.description ?? metadata.description ?? '',
    updatedBy: actorId,
    isPublic: metadata.isPublic === true,
    environment: env
  };

  await AppSetting.findOneAndUpdate(
    { key: storageKey },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (options.syncLegacyAlias && RUNTIME_SETTING_LEGACY_MIRRORS[canonicalKey]) {
    const legacyKey = RUNTIME_SETTING_LEGACY_MIRRORS[canonicalKey];
    await AppSetting.findOneAndUpdate(
      { key: legacyKey },
      {
        $set: {
          key: legacyKey,
          baseKey: canonicalKey,
          value: validation.value,
          valueType: metadata.valueType || inferValueType(validation.value),
          category: 'legacy',
          description: `Legacy mirror for ${canonicalKey}`,
          updatedBy: actorId,
          isPublic: false,
          environment: 'all'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await invalidateRuntimeConfigCache(canonicalKey);

  return buildSettingResponse({ key: canonicalKey, value: validation.value, environment: env });
};

export const listRuntimeConfigs = async (options = {}) => {
  const env = normalizeEnv(options.environment);
  const includeHidden = Boolean(options.includeHidden);
  const categoryFilter = String(options.category || '').trim();

  const keysInCatalog = Object.keys(RUNTIME_SETTINGS_CATALOG);
  const scopedKeys = [
    ...keysInCatalog.map((key) => makeScopedStorageKey(key, env)),
    ...keysInCatalog,
    ...keysInCatalog.map((key) => makeScopedStorageKey(key, 'all'))
  ];

  const records = await AppSetting.find({ key: { $in: scopedKeys } }).lean();
  const byStorageKey = new Map(records.map((record) => [record.key, record]));

  const payload = keysInCatalog
    .map((key) => {
      const metadata = getRuntimeSettingMetadata(key) || {};
      if (!includeHidden && metadata.hidden) return null;
      if (categoryFilter && metadata.category !== categoryFilter) return null;

      const scopedKey = makeScopedStorageKey(key, env);
      const fallbackKey = makeScopedStorageKey(key, 'all');
      const found = byStorageKey.get(scopedKey) || byStorageKey.get(fallbackKey) || byStorageKey.get(key);
      const resolvedValue = coerceSettingValue(
        key,
        found?.value !== undefined ? found.value : metadata.defaultValue
      );

      return {
        key,
        value: resolvedValue,
        category: metadata.category || 'general',
        description: metadata.description || '',
        valueType: metadata.valueType || inferValueType(resolvedValue),
        isPublic: metadata.isPublic === true,
        hidden: metadata.hidden === true,
        environment: found?.environment || env,
        updatedAt: found?.updatedAt || null,
        updatedBy: found?.updatedBy || null,
        defaultValue: metadata.defaultValue
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const categoryDelta = String(a.category || '').localeCompare(String(b.category || ''));
      if (categoryDelta !== 0) return categoryDelta;
      return String(a.key || '').localeCompare(String(b.key || ''));
    });

  return {
    environment: env,
    total: payload.length,
    items: payload
  };
};

const hashString = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const featureFlagCacheKey = (featureName, environment = 'all') =>
  makeCacheKey({ type: 'feature', environment, key: featureName });

const getFeatureFlagDefault = (featureName) => {
  const defaults = FEATURE_FLAG_DEFAULTS[featureName];
  if (!defaults) return null;
  return {
    featureName,
    enabled: Boolean(defaults.enabled),
    rolesAllowed: Array.isArray(defaults.rolesAllowed) ? defaults.rolesAllowed : [],
    rolloutPercentage: Number(defaults.rolloutPercentage || 0),
    description: String(defaults.description || ''),
    environment: 'all'
  };
};

const fetchFeatureFlagRecord = async (featureName, environment = 'all') => {
  const env = normalizeEnv(environment);
  const record =
    (await FeatureFlag.findOne({ featureName, environment: env }).lean()) ||
    (await FeatureFlag.findOne({ featureName, environment: 'all' }).lean());
  return record || getFeatureFlagDefault(featureName);
};

export const getFeatureFlag = async (featureName, options = {}) => {
  const env = normalizeEnv(options.environment);
  const cacheKey = featureFlagCacheKey(featureName, env);

  const hot = getHot(cacheKey);
  if (hot !== null) return hot;

  const cached = await getRedisValue(cacheKey);
  if (cached !== null) return setHot(cacheKey, cached);

  const record = await fetchFeatureFlagRecord(featureName, env);
  if (!record) return null;

  setHot(cacheKey, record);
  void setRedisValue(cacheKey, record);

  return record;
};

export const isFeatureEnabled = async (featureName, options = {}) => {
  const record = await getFeatureFlag(featureName, options);
  if (!record || !record.enabled) {
    return {
      featureName,
      enabled: false,
      reason: 'flag_disabled'
    };
  }

  const role = String(options.role || '').trim();
  if (Array.isArray(record.rolesAllowed) && record.rolesAllowed.length > 0) {
    if (!role || !record.rolesAllowed.includes(role)) {
      return {
        featureName,
        enabled: false,
        reason: 'role_not_allowed',
        rolesAllowed: record.rolesAllowed
      };
    }
  }

  const rollout = Number(record.rolloutPercentage || 0);
  if (rollout >= 100) {
    return {
      featureName,
      enabled: true,
      reason: 'fully_enabled',
      rolloutPercentage: rollout
    };
  }

  const seed = options.userId || options.sessionId || options.deviceId || 'anonymous';
  const bucket = hashString(`${featureName}:${seed}`) % 100;
  const enabled = bucket < rollout;

  return {
    featureName,
    enabled,
    reason: enabled ? 'rollout_enabled' : 'rollout_disabled',
    rolloutPercentage: rollout,
    bucket
  };
};

export const upsertFeatureFlag = async (featureName, payload = {}, options = {}) => {
  const cleanName = String(featureName || '').trim();
  if (!cleanName) {
    const error = new Error('featureName is required');
    error.statusCode = 400;
    throw error;
  }

  const env = normalizeEnv(options.environment);
  const enabled = Boolean(payload.enabled);
  const rollout = Math.max(0, Math.min(100, Number(payload.rolloutPercentage ?? 100)));
  const rolesAllowed = Array.isArray(payload.rolesAllowed)
    ? payload.rolesAllowed
        .map((role) => String(role || '').trim())
        .filter(Boolean)
    : [];

  const doc = await FeatureFlag.findOneAndUpdate(
    { featureName: cleanName, environment: env },
    {
      $set: {
        featureName: cleanName,
        enabled,
        rolesAllowed,
        rolloutPercentage: rollout,
        description: String(payload.description || ''),
        updatedBy: options.updatedBy || null,
        environment: env
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  await invalidateFeatureFlagCache(cleanName);
  return doc;
};

export const listFeatureFlags = async (options = {}) => {
  const env = normalizeEnv(options.environment);
  const records = await FeatureFlag.find({ environment: { $in: [env, 'all'] } })
    .sort({ featureName: 1 })
    .lean();

  const byName = new Map();
  records.forEach((record) => {
    const existing = byName.get(record.featureName);
    if (!existing) {
      byName.set(record.featureName, record);
      return;
    }
    if (existing.environment === 'all' && record.environment === env) {
      byName.set(record.featureName, record);
    }
  });

  Object.entries(FEATURE_FLAG_DEFAULTS).forEach(([featureName, defaults]) => {
    if (!byName.has(featureName)) {
      byName.set(featureName, {
        featureName,
        enabled: Boolean(defaults.enabled),
        rolesAllowed: Array.isArray(defaults.rolesAllowed) ? defaults.rolesAllowed : [],
        rolloutPercentage: Number(defaults.rolloutPercentage || 0),
        description: String(defaults.description || ''),
        environment: 'all'
      });
    }
  });

  const items = Array.from(byName.values()).sort((a, b) =>
    String(a.featureName || '').localeCompare(String(b.featureName || ''))
  );

  return {
    environment: env,
    total: items.length,
    items
  };
};

export const invalidateRuntimeConfigCache = async (keyPrefix = '') => {
  const normalizedPrefix = String(keyPrefix || '').trim();

  const hotKeys = Array.from(inMemoryCache.keys());
  hotKeys.forEach((cacheKey) => {
    if (!normalizedPrefix || cacheKey.includes(`:${normalizedPrefix}`)) {
      inMemoryCache.delete(cacheKey);
    }
  });

  const pattern = normalizedPrefix
    ? `${CACHE_PREFIX}setting:*:${normalizedPrefix}*`
    : `${CACHE_PREFIX}setting:*`;
  return deleteRedisByPattern(pattern);
};

export const invalidateFeatureFlagCache = async (featureName = '') => {
  const prefix = String(featureName || '').trim();

  Array.from(inMemoryCache.keys()).forEach((cacheKey) => {
    if (!cacheKey.includes(`${CACHE_PREFIX}feature:`)) return;
    if (!prefix || cacheKey.endsWith(`:${prefix}`)) {
      inMemoryCache.delete(cacheKey);
    }
  });

  const pattern = prefix
    ? `${CACHE_PREFIX}feature:*:${prefix}`
    : `${CACHE_PREFIX}feature:*`;
  return deleteRedisByPattern(pattern);
};

export const invalidateConfigCache = async () => {
  inMemoryCache.clear();
  return deleteRedisByPattern(`${CACHE_PREFIX}*`);
};

export const refreshConfigCache = async (keys = []) => {
  if (!Array.isArray(keys) || !keys.length) {
    await invalidateConfigCache();
    return { warmed: 0 };
  }

  await Promise.all(keys.map((key) => getRuntimeConfig(key)));
  return { warmed: keys.length };
};

export const getPublicRuntimeConfig = async (options = {}) => {
  const env = normalizeEnv(options.environment);
  const settingsPayload = await listRuntimeConfigs({ environment: env, includeHidden: false });
  const items = Array.isArray(settingsPayload.items) ? settingsPayload.items : [];

  const publicItems = items.filter((item) => item.isPublic === true);
  const values = publicItems.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  const featureList = await listFeatureFlags({ environment: env });
  const featureEntries = await Promise.all(
    (featureList.items || []).map(async (item) => {
      const result = await isFeatureEnabled(item.featureName, {
        environment: env,
        role: options.role,
        userId: options.userId,
        sessionId: options.sessionId,
        deviceId: options.deviceId
      });
      return [
        item.featureName,
        {
          enabled: Boolean(result.enabled),
          rolloutPercentage: Number(item.rolloutPercentage || 0),
          rolesAllowed: Array.isArray(item.rolesAllowed) ? item.rolesAllowed : [],
          reason: result.reason || 'unknown'
        }
      ];
    })
  );

  return {
    environment: env,
    values,
    featureFlags: Object.fromEntries(featureEntries),
    byCategory: publicItems.reduce((acc, item) => {
      const category = item.category || 'general';
      if (!acc[category]) acc[category] = {};
      acc[category][item.key] = item.value;
      return acc;
    }, {})
  };
};

export const ensureRuntimeConfigBootstrap = async () => {
  const operations = Object.entries(RUNTIME_SETTINGS_CATALOG).map(([key, metadata]) => {
    const storageKey = makeScopedStorageKey(key, 'all');
    return AppSetting.updateOne(
      { key: storageKey },
      {
        $setOnInsert: {
          key: storageKey,
          baseKey: key,
          value: metadata.defaultValue,
          valueType: metadata.valueType || inferValueType(metadata.defaultValue),
          category: metadata.category || 'general',
          description: metadata.description || '',
          isPublic: metadata.isPublic === true,
          environment: 'all'
        }
      },
      { upsert: true }
    );
  });

  await Promise.all(operations);

  const featureOps = Object.entries(FEATURE_FLAG_DEFAULTS).map(([featureName, defaults]) =>
    FeatureFlag.updateOne(
      { featureName, environment: 'all' },
      {
        $setOnInsert: {
          featureName,
          enabled: Boolean(defaults.enabled),
          rolesAllowed: Array.isArray(defaults.rolesAllowed) ? defaults.rolesAllowed : [],
          rolloutPercentage: Number(defaults.rolloutPercentage || 0),
          description: String(defaults.description || ''),
          environment: 'all'
        }
      },
      { upsert: true }
    )
  );

  await Promise.all(featureOps);
};

export const preloadRuntimeConfigCache = async () => {
  try {
    await ensureRuntimeConfigBootstrap();
    const publicKeys = Object.entries(RUNTIME_SETTINGS_CATALOG)
      .filter(([, meta]) => meta.isPublic === true)
      .map(([key]) => key);
    await refreshConfigCache(publicKeys);
  } catch {
    // No-op fallback: service still works lazily.
  }
};

export default {
  get: getRuntimeConfig,
  getMany: getManyRuntimeConfigs,
  set: setRuntimeConfig,
  listSettings: listRuntimeConfigs,
  getFeatureFlag,
  isFeatureEnabled,
  listFeatureFlags,
  upsertFeatureFlag,
  getPublicRuntimeConfig,
  invalidateCache: invalidateConfigCache,
  invalidateFeatureFlagCache,
  refreshCache: refreshConfigCache,
  ensureBootstrap: ensureRuntimeConfigBootstrap,
  preloadCache: preloadRuntimeConfigCache
};
