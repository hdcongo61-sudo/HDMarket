import React, { useEffect, useMemo, useState } from 'react';
import { recordNetworkMetric } from '../utils/networkMetrics';

const readConnectionState = () => {
  if (typeof navigator === 'undefined') {
    return { offline: false, slow: false };
  }
  const offline = !navigator.onLine;
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const slow =
    !offline &&
    Boolean(connection?.saveData || ['slow-2g', '2g', '3g'].includes(effectiveType));
  return { offline, slow };
};

export default function NetworkStatusBanner() {
  const [state, setState] = useState(() => readConnectionState());

  useEffect(() => {
    const update = () => setState(readConnectionState());
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

  useEffect(() => {
    recordNetworkMetric({
      source: 'network-state',
      method: 'STATE',
      endpoint: state.offline ? 'offline' : 'online',
      status: state.offline ? 0 : 200,
      durationMs: 0,
      success: !state.offline,
      networkError: state.offline
    });
  }, [state.offline]);

  const content = useMemo(() => {
    if (state.offline) {
      return {
        tone: 'border-rose-200 bg-rose-50 text-rose-700',
        message: 'Vous êtes hors ligne. Certaines actions peuvent échouer.',
        action: 'Réessayer'
      };
    }
    if (state.slow) {
      return {
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
        message: 'Connexion lente détectée. Le chargement peut prendre plus de temps.',
        action: 'Actualiser'
      };
    }
    return null;
  }, [state.offline, state.slow]);

  if (!content) return null;

  return (
    <div className="fixed left-2.5 right-2.5 top-[calc(env(safe-area-inset-top,0px)+4.9rem)] z-[95] sm:left-5 sm:right-5">
      <div className={`rounded-xl border px-3 py-2 text-xs shadow-sm ${content.tone}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{content.message}</p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            className="inline-flex min-h-8 shrink-0 items-center rounded-lg border border-current/25 bg-white/70 px-2.5 text-[11px] font-semibold"
          >
            {content.action}
          </button>
        </div>
      </div>
    </div>
  );
}
