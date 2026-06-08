import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_PREFIX = 'hdmarket:scroll-position:';
const MAX_RESTORE_ATTEMPTS = 18;
const RESTORE_RETRY_MS = 80;

const getScrollY = () => {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, Number(window.scrollY || window.pageYOffset || 0));
};

const getDocumentHeight = () => {
  if (typeof document === 'undefined') return 0;
  const body = document.body;
  const html = document.documentElement;
  return Math.max(
    body?.scrollHeight || 0,
    body?.offsetHeight || 0,
    html?.clientHeight || 0,
    html?.scrollHeight || 0,
    html?.offsetHeight || 0
  );
};

const canUseStorage = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.sessionStorage);
  } catch {
    return false;
  }
};

const safeStorageGet = (key) => {
  if (!canUseStorage()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore private-mode/storage quota failures.
  }
};

const readPosition = (key) => {
  const raw = safeStorageGet(`${STORAGE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const y = Number(parsed?.y);
    if (!Number.isFinite(y) || y <= 0) return null;
    return { y, height: Number(parsed?.height || 0) };
  } catch {
    return null;
  }
};

const savePosition = (key, y = getScrollY()) => {
  if (!key) return;
  safeStorageSet(
    `${STORAGE_PREFIX}${key}`,
    JSON.stringify({
      y,
      height: getDocumentHeight(),
      savedAt: Date.now()
    })
  );
};

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousKeysRef = useRef(null);
  const saveTickRef = useRef(false);
  const prevPathnameRef = useRef(location.pathname);
  const routeKey = useMemo(
    () => `${location.pathname}${location.search}`,
    [location.pathname, location.search]
  );
  const entryKey = useMemo(
    () => `entry:${location.key || routeKey}`,
    [location.key, routeKey]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    previousKeysRef.current = { entryKey, routeKey };

    const saveCurrentPosition = () => {
      const current = previousKeysRef.current;
      if (!current) return;
      const y = getScrollY();
      savePosition(current.entryKey, y);
      savePosition(current.routeKey, y);
    };

    const onScroll = () => {
      if (saveTickRef.current) return;
      saveTickRef.current = true;
      window.requestAnimationFrame(() => {
        saveTickRef.current = false;
        saveCurrentPosition();
      });
    };

    const onPageHide = () => saveCurrentPosition();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentPosition();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      saveCurrentPosition();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [entryKey, routeKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const hash = String(location.hash || '').trim();

    if (hash) {
      let targetId = hash.slice(1);
      try {
        targetId = decodeURIComponent(targetId);
      } catch {
        // Keep the raw hash value if decoding fails.
      }
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ block: 'start' });
      });
      return () => {
        cancelled = true;
      };
    }

    // Only scroll to top when navigating to a different page,
    // not on in-page query param updates (sort, filter, infinite scroll page)
    if (navigationType !== 'POP' && location.pathname === prevPathnameRef.current) return;
    prevPathnameRef.current = location.pathname;

    const saved =
      navigationType === 'POP'
        ? readPosition(entryKey) || readPosition(routeKey)
        : null;

    if (!saved) {
      window.requestAnimationFrame(() => {
        if (!cancelled) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
      return () => {
        cancelled = true;
      };
    }

    const restore = (attempt = 0) => {
      if (cancelled) return;
      const viewportHeight = window.innerHeight || 0;
      const documentHeight = getDocumentHeight();
      const maxScrollY = Math.max(0, documentHeight - viewportHeight);
      const targetY = Math.min(saved.y, maxScrollY || saved.y);

      window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });

      const needsRetry =
        attempt < MAX_RESTORE_ATTEMPTS &&
        saved.y > 0 &&
        (getDocumentHeight() < saved.y + Math.max(160, viewportHeight * 0.5) ||
          Math.abs(getScrollY() - targetY) > 24);

      if (needsRetry) {
        window.setTimeout(() => restore(attempt + 1), RESTORE_RETRY_MS);
      }
    };

    window.requestAnimationFrame(() => restore());

    return () => {
      cancelled = true;
    };
  }, [entryKey, location.hash, navigationType, routeKey]);

  return null;
}
