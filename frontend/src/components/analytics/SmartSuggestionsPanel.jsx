import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';

const priorityClass = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export default function SmartSuggestionsPanel({ suggestions = [] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-900">Suggestions intelligentes</h3>
      </div>
      {!suggestions.length ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <Sparkles className="h-4 w-4" />
            Aucune alerte critique
          </div>
          Vos performances sont stables sur cette période.
        </div>
      ) : (
        <div className="space-y-2.5">
          {suggestions.slice(0, 8).map((item, index) => (
            <div key={`${item.type}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {item.type || 'insight'}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    priorityClass[item.priority] || priorityClass.medium
                  }`}
                >
                  {item.priority || 'medium'}
                </span>
              </div>
              <p className="text-sm text-gray-700">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
