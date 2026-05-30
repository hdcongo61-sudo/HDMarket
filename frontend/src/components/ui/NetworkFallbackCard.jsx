import React from 'react';
import { RefreshCcw } from 'lucide-react';

export default function NetworkFallbackCard({
  title = 'Unable to load data.',
  message = 'Network is slow, please retry.',
  onRetry,
  retryLabel = 'Retry',
  refreshLabel = 'Refresh page'
}) {
  return (
    <section className="glass-card rounded-[24px] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="soft-card soft-card-purple inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 text-sm font-semibold text-purple-900 transition active:scale-[0.98] dark:text-purple-100"
        >
          <RefreshCcw size={14} />
          {retryLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
          className="glass-card inline-flex min-h-[44px] items-center rounded-2xl px-3 text-sm font-semibold text-slate-700 transition active:scale-[0.98] dark:text-slate-100"
        >
          {refreshLabel}
        </button>
      </div>
    </section>
  );
}
