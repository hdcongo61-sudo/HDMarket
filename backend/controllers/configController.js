import asyncHandler from 'express-async-handler';
import {
  getPublicRuntimeConfig,
  getRuntimeConfig,
  invalidateConfigCache,
  listFeatureFlags,
  listRuntimeConfigs,
  refreshConfigCache,
  setRuntimeConfig,
  upsertFeatureFlag
} from '../services/configService.js';
import { normalizeConfigEnvironment } from '../config/runtimeSettingsCatalog.js';
import { invalidateSettingsCache } from '../utils/cache.js';
import { invalidateSettingsResolverCache } from '../utils/settingsResolver.js';
import { createAuditLogEntry } from '../services/auditLogService.js';

const normalizeText = (value = '') => String(value || '').trim();

const resolveEnvironmentFromRequest = (req) => {
  const queryEnv = normalizeText(req.query?.environment || '');
  if (queryEnv) return normalizeConfigEnvironment(queryEnv);

  const bodyEnv = normalizeText(req.body?.environment || '');
  if (bodyEnv) return normalizeConfigEnvironment(bodyEnv);

  const headerEnv = normalizeText(req.headers?.['x-config-environment'] || '');
  if (headerEnv) return normalizeConfigEnvironment(headerEnv);

  return normalizeConfigEnvironment(process.env.APP_CONFIG_ENV || process.env.NODE_ENV || 'all');
};

const isFounderRequest = (req) => req.user?.role === 'founder';

const invalidatePublicSettingsProjection = async () => {
  await Promise.all([
    invalidateSettingsCache(),
    Promise.resolve(invalidateSettingsResolverCache())
  ]);
};

const writeConfigAudit = async (
  req,
  { actionType, previousValue = null, newValue = null, meta = {} } = {}
) => {
  if (!req?.user?.id || !actionType) return null;
  return createAuditLogEntry({
    performedBy: req.user.id,
    actionType,
    previousValue,
    newValue,
    req,
    meta: {
      scope: 'admin_system_settings',
      ...(meta && typeof meta === 'object' ? meta : {})
    }
  });
};

export const getAdminRuntimeSettings = asyncHandler(async (req, res) => {
  const includeHidden =
    String(req.query?.includeHidden || '').toLowerCase() === 'true' || isFounderRequest(req);

  const payload = await listRuntimeConfigs({
    environment: resolveEnvironmentFromRequest(req),
    category: normalizeText(req.query?.category || ''),
    includeHidden
  });

  return res.json(payload);
});

export const getAdminRuntimeSetting = asyncHandler(async (req, res) => {
  const key = normalizeText(req.params?.key);
  if (!key) {
    return res.status(400).json({ message: 'Setting key is required.' });
  }

  const value = await getRuntimeConfig(key, {
    environment: resolveEnvironmentFromRequest(req)
  });

  return res.json({ key, value });
});

export const patchAdminRuntimeSetting = asyncHandler(async (req, res) => {
  const key = normalizeText(req.params?.key);
  if (!key) {
    return res.status(400).json({ message: 'Setting key is required.' });
  }
  const environment = resolveEnvironmentFromRequest(req);
  const previousValue = await getRuntimeConfig(key, { environment });

  const result = await setRuntimeConfig(key, req.body?.value, {
    environment,
    description: normalizeText(req.body?.description || ''),
    updatedBy: req.user?.id || null,
    syncLegacyAlias: true
  });

  await invalidatePublicSettingsProjection();
  await writeConfigAudit(req, {
    actionType: 'admin_system_settings_runtime_updated',
    previousValue,
    newValue: result?.value,
    meta: {
      section: 'runtime',
      key: result?.key || key,
      environment
    }
  });

  return res.json({ message: 'Setting updated.', item: result });
});

export const patchAdminRuntimeSettingsBulk = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(400).json({ message: 'items array is required.' });
  }

  const environment = resolveEnvironmentFromRequest(req);
  const updated = [];
  const changes = [];

  for (const item of items) {
    const key = normalizeText(item?.key);
    if (!key) {
      return res.status(400).json({ message: 'Each item requires a key.' });
    }
    // eslint-disable-next-line no-await-in-loop
    const previousValue = await getRuntimeConfig(key, { environment });
    // eslint-disable-next-line no-await-in-loop
    const result = await setRuntimeConfig(key, item?.value, {
      environment,
      description: normalizeText(item?.description || ''),
      updatedBy: req.user?.id || null,
      syncLegacyAlias: true
    });
    updated.push(result);
    changes.push({
      key: result?.key || key,
      previousValue,
      newValue: result?.value
    });
  }

  await invalidatePublicSettingsProjection();
  if (changes.length) {
    await writeConfigAudit(req, {
      actionType: 'admin_system_settings_runtime_bulk_updated',
      previousValue: changes.map((entry) => ({
        key: entry.key,
        value: entry.previousValue
      })),
      newValue: changes.map((entry) => ({
        key: entry.key,
        value: entry.newValue
      })),
      meta: {
        section: 'runtime',
        environment,
        count: changes.length
      }
    });
  }

  return res.json({ message: 'Settings bulk-updated.', updated });
});

export const getAdminFeatureFlags = asyncHandler(async (req, res) => {
  const payload = await listFeatureFlags({ environment: resolveEnvironmentFromRequest(req) });
  return res.json(payload);
});

export const patchAdminFeatureFlag = asyncHandler(async (req, res) => {
  const featureName = normalizeText(req.params?.featureName);
  if (!featureName) {
    return res.status(400).json({ message: 'featureName is required.' });
  }
  const environment = resolveEnvironmentFromRequest(req);
  const existing = await listFeatureFlags({ environment });
  const previousItem =
    (Array.isArray(existing?.items) ? existing.items : []).find(
      (entry) => String(entry?.featureName || '') === featureName
    ) || null;

  const payload = {
    enabled: req.body?.enabled,
    rolesAllowed: req.body?.rolesAllowed,
    rolloutPercentage: req.body?.rolloutPercentage,
    description: req.body?.description
  };

  const item = await upsertFeatureFlag(featureName, payload, {
    environment,
    updatedBy: req.user?.id || null
  });

  await invalidatePublicSettingsProjection();
  await writeConfigAudit(req, {
    actionType: 'admin_system_settings_feature_flag_updated',
    previousValue: previousItem,
    newValue: item,
    meta: {
      section: 'feature_flags',
      featureName,
      environment
    }
  });

  return res.json({ message: 'Feature flag updated.', item });
});

export const getRuntimePublicConfig = asyncHandler(async (req, res) => {
  const payload = await getPublicRuntimeConfig({
    environment: resolveEnvironmentFromRequest(req),
    role: req.user?.role,
    userId: req.user?.id,
    sessionId: req.headers?.['x-session-id'],
    deviceId: req.headers?.['x-device-id']
  });
  return res.json(payload);
});

export const flushRuntimeConfigCache = asyncHandler(async (_req, res) => {
  await invalidateConfigCache();
  return res.json({ message: 'Config cache invalidated.' });
});

export const warmRuntimeConfigCache = asyncHandler(async (req, res) => {
  const keys = Array.isArray(req.body?.keys)
    ? req.body.keys.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const payload = await refreshConfigCache(keys);
  return res.json({ message: 'Config cache refreshed.', ...payload });
});
