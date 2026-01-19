import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const location = useLocation();
  const storageKey = useMemo(
    () => `hdmarket:scroll:${location.pathname || '/'}`,
    [location.pathname]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    const navEntry = window.performance?.getEntriesByType?.('navigation')?.[0];
    const navType = navEntry?.type || window.performance?.navigation?.type;
    const isReload = navType === 'reload' || navType === 1;

    if (isMobile && isReload) {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) {
        const position = Number(saved);
        if (!Number.isNaN(position)) {
          const restore = () => {
            const maxScroll = Math.max(
              0,
              (document.documentElement?.scrollHeight || 0) - window.innerHeight
            );
            window.scrollTo(0, Math.min(Math.max(0, position), maxScroll));
          };
          window.requestAnimationFrame(restore);
          setTimeout(restore, 60);
          return;
        }
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        window.sessionStorage.setItem(storageKey, String(window.scrollY || 0));
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [storageKey]);

  return null;
}
