import { isFeatureEnabled } from '../services/configService.js';

const decodeHeader = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const getFeatureContext = (req) => ({
  role: req.user?.role,
  accountType: req.user?.accountType,
  userId: req.user?.id || req.user?._id,
  country: req.user?.country || decodeHeader(req.headers?.['x-user-country']),
  countryId: req.countryContext?.countryId || req.user?.selectedCountryId || req.user?.countryId || decodeHeader(req.headers?.['x-country-id']),
  city: req.user?.city || decodeHeader(req.headers?.['x-user-city']),
  commune: req.user?.commune,
  isBetaTester: Boolean(req.user?.betaTester),
  isDeveloper: ['admin', 'founder'].includes(String(req.user?.role || '').toLowerCase()),
  sessionId: req.headers?.['x-session-id'],
  deviceId: req.headers?.['x-device-id'],
  platform: req.headers?.['x-app-platform'] || req.headers?.['x-platform'],
  appVersion: req.headers?.['x-app-version']
});

// Reusable server-side guard for any route introduced behind a feature. The
// 404 response deliberately does not reveal a beta/development feature to an
// ineligible user.
export const requireFeatureAccess = (featureName, options = {}) => async (req, res, next) => {
  try {
    const result = await isFeatureEnabled(featureName, {
      ...getFeatureContext(req),
      environment: options.environment
    });
    if (!result.enabled) {
      return res.status(404).json({
        message: 'Cette fonctionnalité n’est pas disponible.',
        code: 'FEATURE_NOT_AVAILABLE'
      });
    }
    req.featureAccess = result;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireFeatureAccess;
