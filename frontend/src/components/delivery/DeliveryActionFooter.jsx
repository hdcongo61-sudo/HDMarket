import React from 'react';
import { Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function DeliveryActionFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel = 'Report issue',
  onSecondary,
  secondaryDisabled = false
}) {
  const { pathname } = useLocation();
  const insideDeliveryApp = pathname.startsWith('/delivery');

  return (
    <div className={`fixed inset-x-0 z-40 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur-xl sm:px-5 ${insideDeliveryApp ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+70px)] lg:bottom-0 lg:pl-64' : 'bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]'}`}>
      <div className="mx-auto flex w-full max-w-4xl gap-2">
        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            disabled={secondaryDisabled}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition active:scale-[0.98] disabled:opacity-60"
          >
            {secondaryLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {primaryLoading ? <Loader2 size={14} className="animate-spin" /> : null}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
