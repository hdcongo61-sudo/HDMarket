import React from 'react';

export default function DeliveryTabs({ value = 'new', onChange, tabs = [] }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-1">
      <div className="grid grid-cols-3 gap-1">
        {(Array.isArray(tabs) ? tabs : []).map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange?.(tab.key)}
              className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98] ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
