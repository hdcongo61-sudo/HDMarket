import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import useIsMobile from './useIsMobile';
import { subscribeToSettingsRefresh } from '../utils/settingsRefresh';

const APP_LOGO_CACHE_KEY = 'hdmarket:brand-logos';

const readCachedLogos = () => {
  if (typeof window === 'undefined') return { mobile: '', desktop: '' };
  try {
    const cached = JSON.parse(window.localStorage.getItem(APP_LOGO_CACHE_KEY) || '{}');
    return {
      mobile: String(cached?.mobile || ''),
      desktop: String(cached?.desktop || '')
    };
  } catch {
    return { mobile: '', desktop: '' };
  }
};

const cacheLogos = (logos) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_LOGO_CACHE_KEY, JSON.stringify(logos));
  } catch {
    // Storage is an optimization; the API remains the source of truth.
  }
};

const getFallbackLogo = () => {
  if (typeof window === 'undefined') return '/favicon.svg';
  return `${window.location.origin}/favicon.svg`;
};

export default function useAppBrandLogo() {
  const isMobile = useIsMobile(767);
  const [logos, setLogos] = useState(readCachedLogos);

  useEffect(() => {
    let active = true;
    const onLogoUpdate = (event) => {
      if (!active) return;
      setLogos((prev) => {
        const next = {
          mobile: event?.detail?.appLogoMobile || prev.mobile,
          desktop: event?.detail?.appLogoDesktop || prev.desktop
        };
        cacheLogos(next);
        return next;
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hdmarket:app-logo-updated', onLogoUpdate);
    }

    const loadLogos = () => api
      .get('/settings/app-logo', { skipCache: true, headers: { 'x-skip-cache': '1' } })
      .then((res) => {
        if (!active) return;
        const next = {
          mobile: res?.data?.appLogoMobile || '',
          desktop: res?.data?.appLogoDesktop || ''
        };
        cacheLogos(next);
        setLogos(next);
      })
      .catch(() => {
        // silent fallback
      });
    loadLogos();
    const unsubscribe = subscribeToSettingsRefresh(loadLogos);

    return () => {
      active = false;
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('hdmarket:app-logo-updated', onLogoUpdate);
      }
    };
  }, []);

  const resolvedLogo = useMemo(() => {
    if (isMobile) {
      return logos.mobile || logos.desktop || getFallbackLogo();
    }
    return logos.desktop || logos.mobile || getFallbackLogo();
  }, [isMobile, logos.desktop, logos.mobile]);

  return {
    isMobile,
    logoSrc: resolvedLogo,
    mobileLogo: logos.mobile || '',
    desktopLogo: logos.desktop || ''
  };
}
