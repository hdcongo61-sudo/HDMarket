import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const MOBILE_BREAKPOINT = 768;
const SCROLL_BOTTOM_OFFSET = 120;
const TARGET_PATHS = ['/', '/products', '/notifications'];

const MOBILE_NAV_HEIGHT = 70;
const SCROLL_BUTTON_GAP = 18;

export default function MobileScrollToTopButton() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });
  const [showButton, setShowButton] = useState(false);

  const isTargetPage = useMemo(
    () => TARGET_PATHS.includes(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isTargetPage || !isMobile || typeof window === 'undefined') {
      setShowButton(false);
      return undefined;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const viewportHeight = window.innerHeight;
      const docHeight =
        document.documentElement?.scrollHeight ||
        document.body?.scrollHeight ||
        0;
      const nearBottom =
        scrollY + viewportHeight >= docHeight - SCROLL_BOTTOM_OFFSET;
      setShowButton(nearBottom);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTargetPage, isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const event = new CustomEvent('hdmarket:scroll-top-visibility', {
      detail: { visible: showButton }
    });
    window.dispatchEvent(event);
    return undefined;
  }, [showButton]);

  if (!showButton) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }}
      aria-label="Remonter en haut"
      style={{
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${MOBILE_NAV_HEIGHT + SCROLL_BUTTON_GAP}px)`
      }}
      className="fixed right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/95 text-white shadow-xl shadow-indigo-500/40 transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
