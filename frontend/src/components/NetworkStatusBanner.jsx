import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { recordNetworkMetric } from '../utils/networkMetrics';
import useNetworkProfile from '../hooks/useNetworkProfile';

const ACTION_VISIBILITY_MS = 6000;

export default function NetworkStatusBanner() {
  const location = useLocation();
  const {
    offline,
    rapid3GActive,
    offlineBrowsingEnabled,
    offlineBannerText,
    rapid3GBannerText
  } = useNetworkProfile();
  const [showAction, setShowAction] = useState(true);

  useEffect(() => {
    recordNetworkMetric({
      source: 'network-state',
      method: 'STATE',
      endpoint: offline ? 'offline' : rapid3GActive ? 'rapid-3g' : 'online',
      status: offline ? 0 : 200,
      durationMs: 0,
      success: !offline,
      networkError: offline
    });
  }, [offline, rapid3GActive]);

  const content = useMemo(() => {
    if (offline) {
      return {
        tone: 'border-rose-200 bg-rose-50 text-rose-700',
        message: offlineBrowsingEnabled
          ? offlineBannerText
          : 'Vous êtes hors ligne. Certaines actions peuvent échouer.',
        action: 'Actualiser'
      };
    }
    if (rapid3GActive) {
      return {
        tone: 'border-sky-200 bg-sky-50 text-sky-700',
        message: rapid3GBannerText,
        action: ''
      };
    }
    return null;
  }, [offline, offlineBannerText, offlineBrowsingEnabled, rapid3GActive, rapid3GBannerText]);

  useEffect(() => {
    if (!content) {
      setShowAction(true);
      return;
    }

    setShowAction(true);
    const timer = setTimeout(() => {
      setShowAction(false);
    }, ACTION_VISIBILITY_MS);

    return () => clearTimeout(timer);
  }, [content, location.pathname]);

  if (!content) return null;

  return (
    <div className="fixed left-2.5 right-2.5 top-[calc(env(safe-area-inset-top,0px)+4.9rem)] z-[95] sm:left-5 sm:right-5">
      <div className={`rounded-xl border px-3 py-2 text-xs shadow-sm ${content.tone}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{content.message}</p>
          {showAction && content.action ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-current/25 bg-white/70 px-2.5 text-[11px] font-semibold"
            >
              {content.action}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
