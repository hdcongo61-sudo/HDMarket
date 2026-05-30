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
  const offlineBannerText =
    String(
      getRuntimeValue(
        'offline_browsing_banner_text',
        t('network.offline_browsing', 'Mode hors ligne actif. Vous consultez les dernières données mises en cache.')
      ) || ''
    ).trim() ||
    t('network.offline_browsing', 'Mode hors ligne actif. Vous consultez les dernières données mises en cache.');

  return useMemo(
    () => ({
      ...state,
      offlineBrowsingEnabled,
      rapid3GEnabled: false,
      rapid3GActive: false,
      shouldUseOfflineSnapshot: offlineBrowsingEnabled && state.offline,
      compactProductsPageSize: null,
      compactSecondaryLimit: null,
      offlineBannerText,
      rapid3GBannerText: ''
    }),
    [
      state,
      offlineBrowsingEnabled,
      offlineBannerText
    ]
  );
}
