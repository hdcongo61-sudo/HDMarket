import React, { useEffect, useState } from 'react';
import api from '../services/api';

const getFallbackLogo = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/favicon.svg`;
};

export default function AppLoader({
  visible,
  logoSrc,
  label = 'HDMarket',
  timedOut = false,
  onRetry
}) {
  const [logo, setLogo] = useState(logoSrc || '');

  useEffect(() => {
    if (logoSrc) {
      setLogo(logoSrc);
      return;
    }

    let isMounted = true;
    const onAppLogoUpdated = (event) => {
      if (!isMounted) return;
      const updatedLogo = event?.detail?.appLogoMobile || event?.detail?.appLogoDesktop || '';
      if (updatedLogo) {
        setLogo(updatedLogo);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('hdmarket:app-logo-updated', onAppLogoUpdated);
    }
    api
      .get('/settings/app-logo', { skipCache: true })
      .then((res) => {
        if (!isMounted) return;
        const nextLogo = res?.data?.appLogoMobile || res?.data?.appLogoDesktop || '';
        setLogo(nextLogo || '');
      })
      .catch(() => {
        if (!isMounted) return;
        setLogo('');
      });

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('hdmarket:app-logo-updated', onAppLogoUpdated);
      }
    };
  }, [logoSrc]);

  if (!visible) return null;

  const resolvedLogo = logo || getFallbackLogo();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-white/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center">
        <div className="absolute -inset-6 rounded-full border border-neutral-200/70 motion-safe:animate-ping motion-reduce:animate-none" />
        <div className="absolute -inset-10 rounded-full border border-neutral-100/80 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl">
          {resolvedLogo ? (
            <img
              src={resolvedLogo}
              alt={label}
              className="h-12 w-12 object-contain motion-safe:animate-pulse motion-reduce:animate-none"
            />
          ) : (
            <span className="text-lg font-bold text-gray-900">{label}</span>
          )}
        </div>
        <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400">
          {timedOut ? 'Réseau lent' : 'Chargement'}
        </span>
        {timedOut ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm">
            <p className="text-xs text-slate-600">Le chargement prend plus de temps que prévu.</p>
            <button
              type="button"
              onClick={onRetry || (() => window.location.reload())}
              className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white"
            >
              Réessayer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
