import { getRuntimeConfig } from '../services/configService.js';

export const requireAuthProvider = (settingKey, actionLabel) => async (_req, res, next) => {
  try {
    const enabled = await getRuntimeConfig(settingKey, { fallback: true });
    if (enabled !== false) return next();

    return res.status(403).json({
      success: false,
      code: 'AUTH_PROVIDER_DISABLED',
      settingKey,
      message: `${actionLabel} est temporairement désactivée.`
    });
  } catch (error) {
    return next(error);
  }
};
