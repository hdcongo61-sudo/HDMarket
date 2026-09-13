import React from 'react';
import { CheckCircleIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline';

/**
 * "Profil complété" checklist — renders the per-field completion state and
 * lets the user jump straight to the missing field. Powered by
 * utils/profileCompletion.js so the score and the list never disagree.
 */
export default function ProfileCompletionChecklist({ checks = [], percent = 0, isComplete = false, onFix = () => {} }) {
  const remaining = checks.filter((check) => !check.done);

  return (
    <section className="rounded-2xl border border-[#f0c7aa] bg-[#fff8f1] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isComplete ? (
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <SparklesIcon className="h-5 w-5 shrink-0 text-[#e85d00]" />
          )}
          <p className="text-sm font-black text-[#231f1b]">
            {isComplete ? 'Profil complet 🎉' : 'Complétez votre profil'}
          </p>
        </div>
        <span className="shrink-0 text-xs font-black tabular-nums text-[#e85d00]">{percent}%</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ffe2c8]">
        <div
          className="h-full rounded-full bg-[#e85d00] transition-all duration-500"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>

      {remaining.length ? (
        <div className="mt-3 space-y-1.5">
          {remaining.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFix(item.id)}
              className="flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-[#ffe2c8] transition active:scale-[0.99]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff0e4] text-[#e85d00]">
                <ChevronRightIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-[#231f1b]">{item.label}</span>
                <span className="block truncate text-[11px] font-semibold text-[#8a8378]">{item.hint}</span>
              </span>
              <span className="shrink-0 text-[10px] font-black text-[#e85d00]">Compléter</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
