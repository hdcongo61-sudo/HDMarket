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
import { catalogFeatureNames, getCatalogFeature } from '../config/featureCatalog.js';

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
    hidden: metadata.hidden === true,
    allowedValues: Array.isArray(metadata.allowedValues) ? metadata.allowedValues : [],
    min: metadata.min,
    max: metadata.max,
    maxLength: metadata.maxLength
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
  if (canonicalKey === 'enable_parcel_delivery' || canonicalKey.startsWith('parcel_')) {
    try {
      const { invalidatePricingContext } = await import(
        '../modules/delivery/cache/PricingContextCache.js'
      );
      await invalidatePricingContext();
    } catch {
      // Runtime settings remain valid even when the optional pricing cache
      // layer is unavailable; its TTL will recover on the next refresh.
    }
  }

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
        allowedValues: Array.isArray(metadata.allowedValues) ? metadata.allowedValues : [],
        min: metadata.min,
        max: metadata.max,
        maxLength: metadata.maxLength,
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

const cleanText = (value) => String(value || '').trim();
const cleanStringArray = (value) =>
  Array.from(new Set((Array.isArray(value) ? value : []).map(cleanText).filter(Boolean)));
const clampRollout = (value, fallback = 100) =>
  Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : fallback));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const normalizeTargeting = (targeting = {}, legacyRoles = []) => ({
  userIds: Array.from(
    new Set((Array.isArray(targeting?.userIds) ? targeting.userIds : []).map((item) => String(item || '')).filter(Boolean))
  ),
  roles: cleanStringArray(targeting?.roles?.length ? targeting.roles : legacyRoles),
  countries: cleanStringArray(targeting?.countries),
  cities: cleanStringArray(targeting?.cities),
  communes: cleanStringArray(targeting?.communes),
  platforms: cleanStringArray(targeting?.platforms)
    .map((item) => item.toLowerCase())
    .filter((item) => ['android', 'ios', 'web', 'pwa'].includes(item)),
  minAppVersion: cleanText(targeting?.minAppVersion),
  betaTestersOnly: Boolean(targeting?.betaTestersOnly)
});

const normalizeSchedule = (schedule = {}) => ({
  releaseAt: schedule?.releaseAt ? new Date(schedule.releaseAt) : null,
  expiresAt: schedule?.expiresAt ? new Date(schedule.expiresAt) : null,
  timezone: cleanText(schedule?.timezone) || 'Africa/Brazzaville'
});

const normalizeExperiments = (experiments = []) =>
  (Array.isArray(experiments) ? experiments : [])
    .map((experiment) => ({
      key: cleanText(experiment?.key),
      name: cleanText(experiment?.name),
      rolloutPercentage: clampRollout(experiment?.rolloutPercentage, 0),
      config:
        experiment?.config && typeof experiment.config === 'object' && !Array.isArray(experiment.config)
          ? experiment.config
          : {}
    }))
    .filter((experiment) => experiment.key);

const getFeatureFlagDefault = (featureName) => {
  const legacy = FEATURE_FLAG_DEFAULTS[featureName] || null;
  const catalog = getCatalogFeature(featureName);
  if (!legacy && !catalog) return null;

  const enabled = catalog?.enabled ?? legacy?.enabled ?? false;
  const rolesAllowed = cleanStringArray(legacy?.rolesAllowed || catalog?.rolesAllowed || []);
  return {
    featureName,
    displayName: catalog?.displayName || featureName,
    category: catalog?.category || 'other',
    icon: catalog?.icon || 'Sparkles',
    version: catalog?.version || '1.0.0',
    enabled: Boolean(enabled),
    emergencyDisabled: false,
    releaseStage: catalog?.releaseStage || (enabled ? 'released' : 'development'),
    rolesAllowed,
    rolloutPercentage: clampRollout(catalog?.rolloutPercentage ?? legacy?.rolloutPercentage, enabled ? 100 : 0),
    description: String(catalog?.description || legacy?.description || ''),
    targeting: normalizeTargeting(catalog?.targeting || {}, rolesAllowed),
    dependencies: cleanStringArray(catalog?.dependencies),
    remoteConfig: catalog?.remoteConfig || {},
    schedule: normalizeSchedule(catalog?.schedule),
    experiments: normalizeExperiments(catalog?.experiments),
    environment: 'all',
    isCatalogDefault: true
  };
};

const normalizeFeatureFlag = (record = {}) => {
  if (!record) return null;
  const featureName = cleanText(record.featureName);
  const fallback = getFeatureFlagDefault(featureName) || {};
  const rolesAllowed = cleanStringArray(record.rolesAllowed ?? fallback.rolesAllowed ?? []);
  const targeting = normalizeTargeting(record.targeting ?? fallback.targeting ?? {}, rolesAllowed);
  return {
    ...fallback,
    ...record,
    featureName,
    displayName: cleanText(record.displayName || fallback.displayName || featureName),
    category: cleanText(record.category || fallback.category || 'other'),
    icon: cleanText(record.icon || fallback.icon || 'Sparkles'),
    version: cleanText(record.version || fallback.version || '1.0.0'),
    enabled: Boolean(record.enabled ?? fallback.enabled),
    emergencyDisabled: Boolean(record.emergencyDisabled),
    releaseStage: ['development', 'beta', 'released', 'archived'].includes(record.releaseStage)
      ? record.releaseStage
      : fallback.releaseStage || 'development',
    rolesAllowed,
    rolloutPercentage: clampRollout(record.rolloutPercentage ?? fallback.rolloutPercentage, 100),
    description: String(record.description ?? fallback.description ?? ''),
    targeting,
    dependencies: cleanStringArray(record.dependencies ?? fallback.dependencies ?? []),
    remoteConfig:
      record.remoteConfig && typeof record.remoteConfig === 'object' && !Array.isArray(record.remoteConfig)
        ? record.remoteConfig
        : fallback.remoteConfig || {},
    schedule: normalizeSchedule(record.schedule ?? fallback.schedule ?? {}),
    experiments: normalizeExperiments(record.experiments ?? fallback.experiments ?? []),
    environment: normalizeEnv(record.environment || fallback.environment || 'all')
  };
};

const fetchFeatureFlagRecord = async (featureName, environment = 'all') => {
  const env = normalizeEnv(environment);
  const record =
    (await FeatureFlag.findOne({ featureName, environment: env }).lean()) ||
    (await FeatureFlag.findOne({ featureName, environment: 'all' }).lean());
  return normalizeFeatureFlag(record || getFeatureFlagDefault(featureName));
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

const compareVersions = (currentVersion = '', minimumVersion = '') => {
  const parse = (value) =>
    cleanText(value)
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((part) => (Number.isFinite(Number(part)) ? Number(part) : 0));
  const current = parse(currentVersion);
  const minimum = parse(minimumVersion);
  const width = Math.max(current.length, minimum.length, 3);
  for (let index = 0; index < width; index += 1) {
    const currentPart = current[index] || 0;
    const minimumPart = minimum[index] || 0;
    if (currentPart > minimumPart) return 1;
    if (currentPart < minimumPart) return -1;
  }
  return 0;
};

const getEffectiveStage = (record, referenceDate = new Date()) => {
  const configuredStage = record.releaseStage || 'development';
  const schedule = record.schedule || {};
  const expiresAt = schedule.expiresAt ? new Date(schedule.expiresAt) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= referenceDate) {
    return { stage: configuredStage, expired: true, automaticallyReleased: false };
  }
  const releaseAt = schedule.releaseAt ? new Date(schedule.releaseAt) : null;
  const automaticallyReleased =
    configuredStage === 'beta' && releaseAt && !Number.isNaN(releaseAt.getTime()) && releaseAt <= referenceDate;
  return {
    stage: automaticallyReleased ? 'released' : configuredStage,
    expired: false,
    automaticallyReleased
  };
};

const withFeatureRuntimeState = (record) => {
  const state = getEffectiveStage(record);
  return {
    ...record,
    effectiveReleaseStage: state.stage,
    isExpired: state.expired,
    automaticallyReleased: state.automaticallyReleased
  };
};

const evaluateExperiment = (record, seed) => {
  const experiments = normalizeExperiments(record.experiments);
  const bucket = hashString(`${record.featureName}:experiment:${seed}`) % 100;
  let threshold = 0;
  for (const experiment of experiments) {
    threshold += experiment.rolloutPercentage;
    if (bucket < threshold) {
      return {
        variant: experiment.key,
        experiment: experiment.name || experiment.key,
        bucket,
        config: { ...(record.remoteConfig || {}), ...(experiment.config || {}) }
      };
    }
  }
  return { variant: 'control', experiment: '', bucket, config: { ...(record.remoteConfig || {}) } };
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

  if (record.emergencyDisabled) {
    return { featureName, enabled: false, reason: 'emergency_disabled' };
  }

  const nowDate = options.now instanceof Date ? options.now : new Date();
  const stageState = getEffectiveStage(record, nowDate);
  if (stageState.expired) {
    return { featureName, enabled: false, reason: 'feature_expired' };
  }
  if (stageState.stage === 'archived') {
    return { featureName, enabled: false, reason: 'feature_archived' };
  }

  const role = String(options.role || '').trim();
  const targeting = normalizeTargeting(record.targeting, record.rolesAllowed);
  const isPrivilegedDeveloper =
    Boolean(options.isDeveloper) || ['founder', 'admin'].includes(String(role || '').toLowerCase());
  if (stageState.stage === 'development' && !isPrivilegedDeveloper) {
    return { featureName, enabled: false, reason: 'development_only' };
  }

  const userId = String(options.userId || '');
  const isSpecificallyTargeted = targeting.userIds.includes(userId);
  if (targeting.userIds.length > 0 && !isSpecificallyTargeted) {
    return { featureName, enabled: false, reason: 'user_not_targeted' };
  }

  const isBetaTester = Boolean(options.isBetaTester);
  if (stageState.stage === 'beta' && !isSpecificallyTargeted && !isBetaTester) {
    return { featureName, enabled: false, reason: 'beta_tester_required' };
  }
  if (targeting.betaTestersOnly && !isSpecificallyTargeted && !isBetaTester) {
    return { featureName, enabled: false, reason: 'beta_tester_required' };
  }

  if (targeting.roles.length > 0) {
    const roles = [role, String(options.accountType || '').trim()].filter(Boolean);
    if (!roles.some((candidate) => targeting.roles.includes(candidate))) {
      return {
        featureName,
        enabled: false,
        reason: 'role_not_allowed',
        rolesAllowed: targeting.roles
      };
    }
  }

  const locationRules = [
    ['countries', options.country, 'country_not_allowed'],
    ['cities', options.city, 'city_not_allowed'],
    ['communes', options.commune, 'commune_not_allowed']
  ];
  for (const [field, requestedValue, reason] of locationRules) {
    if (targeting[field].length > 0 && !targeting[field].includes(cleanText(requestedValue))) {
      return { featureName, enabled: false, reason };
    }
  }

  const platform = cleanText(options.platform).toLowerCase();
  if (targeting.platforms.length > 0 && !targeting.platforms.includes(platform)) {
    return { featureName, enabled: false, reason: 'platform_not_allowed' };
  }

  if (
    targeting.minAppVersion &&
    compareVersions(cleanText(options.appVersion), targeting.minAppVersion) < 0
  ) {
    return {
      featureName,
      enabled: false,
      reason: 'app_version_too_old',
      minAppVersion: targeting.minAppVersion
    };
  }

  const visited = options._visited instanceof Set ? options._visited : new Set();
  if (visited.has(featureName)) {
    return { featureName, enabled: false, reason: 'dependency_cycle' };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(featureName);
  for (const dependency of record.dependencies || []) {
    // Dependencies keep the same audience and deterministic seed as the parent.
    const dependencyResult = await isFeatureEnabled(dependency, { ...options, _visited: nextVisited });
    if (!dependencyResult.enabled) {
      return {
        featureName,
        enabled: false,
        reason: 'dependency_not_available',
        dependency,
        dependencyReason: dependencyResult.reason
      };
    }
  }

  const rollout = Number(record.rolloutPercentage || 0);
  const seed = options.userId || options.sessionId || options.deviceId || 'anonymous';
  const bucket = hashString(`${featureName}:${seed}`) % 100;
  const enabled = rollout >= 100 || bucket < rollout;
  const experiment = enabled ? evaluateExperiment(record, seed) : null;

  return {
    featureName,
    enabled,
    reason: enabled ? (rollout >= 100 ? 'fully_enabled' : 'rollout_enabled') : 'rollout_disabled',
    rolloutPercentage: rollout,
    bucket,
    releaseStage: stageState.stage,
    automaticallyReleased: stageState.automaticallyReleased,
    variant: experiment?.variant || 'control',
    experiment: experiment?.experiment || '',
    config: experiment?.config || {}
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
  const existing = await fetchFeatureFlagRecord(cleanName, env);
  const catalog = getCatalogFeature(cleanName) || {};
  const existingTargeting = normalizeTargeting(existing?.targeting, existing?.rolesAllowed);
  const requestedTargeting = hasOwn(payload, 'targeting')
    ? payload.targeting || {}
    : existingTargeting;
  const rolesAllowed = cleanStringArray(
    hasOwn(payload, 'rolesAllowed') ? payload.rolesAllowed : requestedTargeting?.roles || existing?.rolesAllowed || []
  );
  const targeting = normalizeTargeting(
    {
      ...existingTargeting,
      ...(requestedTargeting && typeof requestedTargeting === 'object' ? requestedTargeting : {}),
      ...(hasOwn(payload, 'rolesAllowed') ? { roles: rolesAllowed } : {})
    },
    rolesAllowed
  );
  const enabled = hasOwn(payload, 'enabled') ? Boolean(payload.enabled) : Boolean(existing?.enabled ?? catalog.enabled);
  const releaseStage = hasOwn(payload, 'releaseStage')
    ? cleanText(payload.releaseStage).toLowerCase()
    : existing?.releaseStage || catalog.releaseStage || 'development';
  if (!['development', 'beta', 'released', 'archived'].includes(releaseStage)) {
    const error = new Error('Invalid release stage');
    error.statusCode = 400;
    throw error;
  }
  const dependencies = cleanStringArray(
    hasOwn(payload, 'dependencies') ? payload.dependencies : existing?.dependencies || catalog.dependencies || []
  ).filter((dependency) => dependency !== cleanName);
  const schedule = normalizeSchedule(
    hasOwn(payload, 'schedule') ? payload.schedule : existing?.schedule || catalog.schedule || {}
  );
  if (schedule.releaseAt && Number.isNaN(schedule.releaseAt.getTime())) {
    const error = new Error('Invalid release date');
    error.statusCode = 400;
    throw error;
  }
  if (schedule.expiresAt && Number.isNaN(schedule.expiresAt.getTime())) {
    const error = new Error('Invalid expiration date');
    error.statusCode = 400;
    throw error;
  }
  if (schedule.releaseAt && schedule.expiresAt && schedule.expiresAt <= schedule.releaseAt) {
    const error = new Error('Expiration must be after the release date');
    error.statusCode = 400;
    throw error;
  }

  if (enabled && releaseStage !== 'archived') {
    for (const dependency of dependencies) {
      const dependencyRecord = await getFeatureFlag(dependency, { environment: env });
      const dependencyState = dependencyRecord ? getEffectiveStage(dependencyRecord) : null;
      if (
        !dependencyRecord ||
        !dependencyRecord.enabled ||
        dependencyRecord.emergencyDisabled ||
        dependencyState?.expired ||
        dependencyState?.stage === 'archived'
      ) {
        const error = new Error(`Dependency ${dependency} is not enabled`);
        error.statusCode = 409;
        error.dependency = dependency;
        throw error;
      }
    }
  }

  const doc = await FeatureFlag.findOneAndUpdate(
    { featureName: cleanName, environment: env },
    {
      $set: {
        featureName: cleanName,
        enabled,
        displayName: cleanText(payload.displayName ?? existing?.displayName ?? catalog.displayName ?? cleanName),
        category: cleanText(payload.category ?? existing?.category ?? catalog.category ?? 'other'),
        icon: cleanText(payload.icon ?? existing?.icon ?? catalog.icon ?? 'Sparkles'),
        version: cleanText(payload.version ?? existing?.version ?? catalog.version ?? '1.0.0'),
        emergencyDisabled: hasOwn(payload, 'emergencyDisabled')
          ? Boolean(payload.emergencyDisabled)
          : Boolean(existing?.emergencyDisabled),
        releaseStage,
        rolesAllowed,
        rolloutPercentage: clampRollout(payload.rolloutPercentage ?? existing?.rolloutPercentage, 100),
        description: String(payload.description ?? existing?.description ?? catalog.description ?? ''),
        targeting,
        dependencies,
        remoteConfig:
          hasOwn(payload, 'remoteConfig') && payload.remoteConfig && typeof payload.remoteConfig === 'object'
            ? payload.remoteConfig
            : existing?.remoteConfig || catalog.remoteConfig || {},
        schedule,
        experiments: normalizeExperiments(
          hasOwn(payload, 'experiments') ? payload.experiments : existing?.experiments || catalog.experiments || []
        ),
        updatedBy: options.updatedBy || null,
        environment: env
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  await invalidateFeatureFlagCache(cleanName);
  return normalizeFeatureFlag(doc);
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

  Array.from(new Set([...Object.keys(FEATURE_FLAG_DEFAULTS), ...catalogFeatureNames()])).forEach((featureName) => {
    if (!byName.has(featureName)) {
      byName.set(featureName, getFeatureFlagDefault(featureName));
    }
  });

  const items = Array.from(byName.values()).map(normalizeFeatureFlag).map(withFeatureRuntimeState).sort((a, b) =>
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
        deviceId: options.deviceId,
        accountType: options.accountType,
        country: options.country,
        city: options.city,
        commune: options.commune,
        platform: options.platform,
        appVersion: options.appVersion,
        isBetaTester: options.isBetaTester,
        isDeveloper: options.isDeveloper
      });
      return [
        item.featureName,
        {
          enabled: Boolean(result.enabled),
          rolloutPercentage: Number(item.rolloutPercentage || 0),
          rolesAllowed: Array.isArray(item.rolesAllowed) ? item.rolesAllowed : [],
          reason: result.reason || 'unknown',
          variant: result.variant || 'control',
          config: result.enabled ? result.config || {} : {}
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

  const defaultMigrations = Object.entries(RUNTIME_SETTINGS_CATALOG)
    .filter(([, metadata]) => Array.isArray(metadata.legacyDefaultValues) && metadata.legacyDefaultValues.length)
    .map(([key, metadata]) =>
      AppSetting.updateMany(
        {
          key: makeScopedStorageKey(key, 'all'),
          value: { $in: metadata.legacyDefaultValues },
          updatedBy: null
        },
        { $set: { value: metadata.defaultValue } }
      )
    );
  await Promise.all(defaultMigrations);

  const featureOps = Array.from(
    new Set([...Object.keys(FEATURE_FLAG_DEFAULTS), ...catalogFeatureNames()])
  ).map((featureName) => {
    const defaults = getFeatureFlagDefault(featureName);
    return FeatureFlag.updateOne(
      { featureName, environment: 'all' },
      {
        $setOnInsert: {
          featureName,
          displayName: defaults?.displayName || featureName,
          category: defaults?.category || 'other',
          icon: defaults?.icon || 'Sparkles',
          version: defaults?.version || '1.0.0',
          enabled: Boolean(defaults?.enabled),
          emergencyDisabled: false,
          releaseStage: defaults?.releaseStage || 'development',
          rolesAllowed: defaults?.rolesAllowed || [],
          rolloutPercentage: Number(defaults?.rolloutPercentage || 0),
          description: String(defaults?.description || ''),
          targeting: defaults?.targeting || {},
          dependencies: defaults?.dependencies || [],
          remoteConfig: defaults?.remoteConfig || {},
          schedule: defaults?.schedule || {},
          experiments: defaults?.experiments || [],
          environment: 'all'
        }
      },
      { upsert: true, setDefaultsOnInsert: false }
    );
  });

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
