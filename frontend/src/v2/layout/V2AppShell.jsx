import React from 'react';
import { motion } from 'framer-motion';
import { motionEase } from '../motion';

export default function V2AppShell({ sections, activeKey, onChange, children }) {
  return (
    <div className="v2-page min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-6">
        <div className="overflow-x-auto pb-2">
          <div className="inline-flex min-w-full gap-2 rounded-2xl border v2-divider bg-[var(--v2-surface)] p-2">
            {sections.map((section) => {
              const active = activeKey === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => onChange(section.key)}
                  className={`relative rounded-xl px-3 py-2 text-xs font-medium v2-safe-transition sm:text-sm ${
                    active
                      ? 'text-white'
                      : 'text-[var(--v2-text-soft)] hover:bg-[var(--v2-surface-soft)]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="v2-active-tab"
                      transition={{ duration: 0.25, ease: motionEase }}
                      className="absolute inset-0 rounded-xl bg-[var(--v2-accent)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {section.icon}
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
