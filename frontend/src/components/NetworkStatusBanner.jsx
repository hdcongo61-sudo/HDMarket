import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloudOff, Wifi, WifiOff } from 'lucide-react';
import { recordNetworkMetric } from '../utils/networkMetrics';
import useNetworkProfile from '../hooks/useNetworkProfile';

const RECONNECTED_VISIBILITY_MS = 3500;

export default function NetworkStatusBanner() {
  const {
    offline,
    rapid3GActive,
    offlineBrowsingEnabled,
    offlineBannerText,
    rapid3GBannerText
  } = useNetworkProfile();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

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

  // When the network comes back, confirm it briefly instead of letting the
  // offline pill vanish without feedback.
  useEffect(() => {
    if (offline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
      return undefined;
    }
    if (!wasOfflineRef.current) return undefined;
    wasOfflineRef.current = false;
    setShowReconnected(true);
    const timer = setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBILITY_MS);
    return () => clearTimeout(timer);
  }, [offline]);

  const content = useMemo(() => {
    if (offline) {
      return {
        icon: WifiOff,
        tone: 'border-slate-700 bg-slate-900/95 text-white',
        iconTone: 'bg-rose-500/20 text-rose-300',
        title: 'Vous êtes hors ligne',
        subtitle: offlineBrowsingEnabled
          ? offlineBannerText
          : 'Certaines actions peuvent échouer tant que le réseau est coupé.'
      };
    }
    if (rapid3GActive) {
      return {
        icon: CloudOff,
        tone: 'border-sky-700 bg-sky-950/95 text-white',
        iconTone: 'bg-sky-400/20 text-sky-300',
        title: rapid3GBannerText,
        subtitle: ''
      };
    }
    if (showReconnected) {
      return {
        icon: Wifi,
        tone: 'border-emerald-700 bg-emerald-950/95 text-white',
        iconTone: 'bg-emerald-400/20 text-emerald-300',
        title: 'Connexion rétablie',
        subtitle: ''
      };
    }
    return null;
  }, [offline, offlineBannerText, offlineBrowsingEnabled, rapid3GActive, rapid3GBannerText, showReconnected]);

  if (!content) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+4.9rem)] z-[95] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`network-status-banner flex max-w-sm items-center gap-2.5 rounded-full border py-2 pl-2.5 pr-4 shadow-lg backdrop-blur-sm ${content.tone}`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${content.iconTone}`}>
          {React.createElement(content.icon, { size: 15, strokeWidth: 2.25 })}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">{content.title}</p>
          {content.subtitle ? (
            <p className="mt-0.5 text-[11px] leading-snug text-white/70">{content.subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
