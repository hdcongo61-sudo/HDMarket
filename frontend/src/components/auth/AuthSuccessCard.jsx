import React from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function AuthSuccessCard({
  variant = 'login',
  loading = false,
  title,
  description,
  secondaryDescription = '',
  actions = [],
  statusText = 'Préparation de votre espace...'
}) {
  const Icon = variant === 'register' ? Sparkles : CheckCircle2;

  return (
    <section className="glass-fade-in rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-7">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-100">
        <Icon size={26} />
      </div>
      <h2 className="mt-4 text-xl font-black text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{description}</p>
      {secondaryDescription ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-300">{secondaryDescription}</p>
      ) : null}

      <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 dark:bg-neutral-900 dark:text-slate-200">
        <Loader2 size={13} className={join(loading ? 'animate-spin' : 'animate-pulse')} />
        {statusText}
      </div>

      {actions.length ? (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={Boolean(action.disabled)}
              className={join(
                'min-h-[48px] rounded px-4 text-sm font-black transition active:scale-[0.98]',
                action.primary
                  ? 'bg-[#e85d00] text-white hover:bg-[#e85f00]'
                  : 'border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-100',
                action.disabled ? 'opacity-60 cursor-not-allowed' : ''
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
