import React from 'react';

const normalizeLogoSource = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(value.secure_url || value.url || value.src || '').trim();
};

export default function AppLoader({
  visible,
  logoSrc,
  label = 'HDMarket',
  timedOut = false,
  onRetry
}) {
  if (!visible) return null;

  const resolvedLogo = normalizeLogoSource(logoSrc);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-white/95"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center">
        <div className="absolute -inset-6 rounded-full border border-neutral-200/70 motion-safe:animate-ping motion-reduce:animate-none" />
        <div className="absolute -inset-10 rounded-full border border-neutral-100/80 motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm">
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
          {timedOut ? 'Synchronisation' : 'Chargement'}
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
