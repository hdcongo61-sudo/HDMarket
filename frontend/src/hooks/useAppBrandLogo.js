import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import useIsMobile from './useIsMobile';

const getFallbackLogo = () => {
  if (typeof window === 'undefined') return '/favicon.svg';
  return `${window.location.origin}/favicon.svg`;
};

export default function useAppBrandLogo() {
  const isMobile = useIsMobile(767);
  const [logos, setLogos] = useState({
    mobile: '',
    desktop: ''
  });

  useEffect(() => {
    let active = true;
    const onLogoUpdate = (event) => {
      if (!active) return;
      setLogos((prev) => ({
        mobile: event?.detail?.appLogoMobile || prev.mobile,
        desktop: event?.detail?.appLogoDesktop || prev.desktop
      }));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hdmarket:app-logo-updated', onLogoUpdate);
    }

    api
      .get('/settings/app-logo', { skipCache: true })
      .then((res) => {
        if (!active) return;
        setLogos({
          mobile: res?.data?.appLogoMobile || '',
          desktop: res?.data?.appLogoDesktop || ''
        });
      })
      .catch(() => {
        // silent fallback
      });

    return () => {
      active = false;
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
