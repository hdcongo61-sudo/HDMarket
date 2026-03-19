import { useEffect, useMemo, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';

const SLOW_NETWORK_TYPES = new Set(['slow-2g', '2g', '3g']);

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const parsePositiveInt = (value, fallback, min = 1, max = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const readNavigatorNetworkState = () => {
  if (typeof navigator === 'undefined') {
    return {
      offline: false,
      slowConnection: false,
      saveData: false,
      effectiveType: ''
    };
  }

  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const effectiveType = String(connection?.effectiveType || '').trim().toLowerCase();
  const saveData = Boolean(connection?.saveData);
  const offline = navigator.onLine === false;
  const slowConnection = !offline && (saveData || SLOW_NETWORK_TYPES.has(effectiveType));

  return {
    offline,
    slowConnection,
    saveData,
    effectiveType
  };
};

export default function useNetworkProfile() {
  const { getRuntimeValue, t } = useAppSettings();
  const [state, setState] = useState(() => readNavigatorNetworkState());

  useEffect(() => {
    const update = () => setState(readNavigatorNetworkState());
    const connection =
      typeof navigator !== 'undefined'
        ? navigator.connection || navigator.mozConnection || navigator.webkitConnection || null
        : null;

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    connection?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  const offlineBrowsingEnabled = toBoolean(getRuntimeValue('enable_offline_browsing', true), true);
  const rapid3GEnabled = toBoolean(getRuntimeValue('enable_rapid_3g_mode', true), true);
  const rapid3GProductsPageSize = parsePositiveInt(
    getRuntimeValue('rapid_3g_products_page_size', 8),
    8,
    4,
    20
  );
  const rapid3GSecondaryLimit = parsePositiveInt(
    getRuntimeValue('rapid_3g_secondary_limit', 4),
    4,
    2,
    12
  );
  const offlineBannerText =
    String(
      getRuntimeValue(
        'offline_browsing_banner_text',
        t('network.offline_browsing', 'Mode hors ligne actif. Vous consultez les dernières données mises en cache.')
      ) || ''
    ).trim() ||
    t('network.offline_browsing', 'Mode hors ligne actif. Vous consultez les dernières données mises en cache.');
  const rapid3GBannerText =
    String(
      getRuntimeValue(
        'rapid_3g_banner_text',
        t('network.rapid3g', 'Mode Rapide 3G actif. Les contenus lourds sont allégés pour accélérer le chargement.')
      ) || ''
    ).trim() ||
    t('network.rapid3g', 'Mode Rapide 3G actif. Les contenus lourds sont allégés pour accélérer le chargement.');

  return useMemo(
    () => ({
      ...state,
      offlineBrowsingEnabled,
      rapid3GEnabled,
      rapid3GActive: rapid3GEnabled && state.slowConnection && !state.offline,
      shouldUseOfflineSnapshot: offlineBrowsingEnabled && state.offline,
      compactProductsPageSize: rapid3GEnabled && state.slowConnection && !state.offline ? rapid3GProductsPageSize : null,
      compactSecondaryLimit: rapid3GEnabled && state.slowConnection && !state.offline ? rapid3GSecondaryLimit : null,
      offlineBannerText,
      rapid3GBannerText
    }),
    [
      state,
      offlineBrowsingEnabled,
      rapid3GEnabled,
      rapid3GProductsPageSize,
      rapid3GSecondaryLimit,
      offlineBannerText,
      rapid3GBannerText
    ]
  );
}
