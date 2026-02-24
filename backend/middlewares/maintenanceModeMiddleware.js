import { getRuntimeConfig } from '../services/configService.js';

const PUBLIC_ALLOWLIST_PREFIXES = [
  '/api/health',
  '/api/settings/public',
  '/api/settings/runtime',
  '/api/settings/app-logo',
  '/api/settings/hero-banner',
  '/api/settings/promo-banner',
  '/api/settings/splash',
  '/api/auth/',
  '/api/admin/',
  '/api/founder/'
];

const isAllowlistedPath = (path = '') =>
  PUBLIC_ALLOWLIST_PREFIXES.some((prefix) => String(path || '').startsWith(prefix));

export const maintenanceModeMiddleware = async (req, res, next) => {
  const targetPath = String(req.originalUrl || req.url || '');
  if (!targetPath.startsWith('/api')) return next();
  if (isAllowlistedPath(targetPath)) return next();

  try {
    const isMaintenance = Boolean(await getRuntimeConfig('maintenance_mode', { fallback: false }));
    if (!isMaintenance) return next();

    const message = String(
      (await getRuntimeConfig('maintenance_message', {
        fallback: 'Maintenance en cours. Merci de réessayer plus tard.'
      })) || 'Maintenance en cours. Merci de réessayer plus tard.'
    );

    return res.status(503).json({
      message,
      maintenance: true,
      code: 'MAINTENANCE_MODE'
    });
  } catch {
    return next();
  }
};

export default maintenanceModeMiddleware;
