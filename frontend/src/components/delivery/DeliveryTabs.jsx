import React from 'react';
import LiquidGlassCard from '../ui/liquid-notification';

export default function DeliveryTabs({ value = 'new', onChange, tabs = [] }) {
  return (
    <LiquidGlassCard
      draggable={false}
      blurIntensity="md"
      glowIntensity="xs"
      shadowIntensity="xs"
      borderRadius="16px"
      className="p-1"
    >
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
    </LiquidGlassCard>
  );
}
