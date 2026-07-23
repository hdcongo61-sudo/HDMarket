import React from 'react';

export default function DeliveryTabs({ value = 'new', onChange, tabs = [] }) {
  const count = Array.isArray(tabs) ? tabs.length : 0;
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
      <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${count || 1}, minmax(0, 1fr))` }}>
        {(Array.isArray(tabs) ? tabs : []).map((tab) => {
          const active = value === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange?.(tab.key)}
              className={`min-h-[44px] rounded-lg px-3 text-sm font-black transition active:scale-[0.98] ${
                active
                  ? 'bg-[#FF6A00] text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
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
