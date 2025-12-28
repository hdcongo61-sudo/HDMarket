import { useEffect } from 'react';

export default function usePreventNewTabOnMobile(breakpoint = 767) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const findAnchor = (event) => {
      if (typeof event.composedPath === 'function') {
        return event
          .composedPath()
          .find(
            (el) =>
              el instanceof HTMLElement &&
              (el.tagName === 'A' || el.tagName === 'AREA') &&
              el.getAttribute('target') === '_blank'
          );
      }

      const target = event.target;
      if (target && typeof target.closest === 'function') {
        return target.closest('a[target="_blank"],area[target="_blank"]');
      }
      return null;
    };

    const handler = (event) => {
      if (!mediaQuery.matches) return;
      const anchor = findAnchor(event);
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      const url = new URL(href, window.location.href);
      const isInternal = url.origin === window.location.origin;
      if (!isInternal) return;

      event.preventDefault();
      window.location.assign(url.pathname + url.search + url.hash);
    };

    document.addEventListener('click', handler);
    return () => {
      document.removeEventListener('click', handler);
    };
  }, [breakpoint]);
}
