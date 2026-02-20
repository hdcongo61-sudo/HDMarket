import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion';

export default function V2Card({ title, subtitle, right, children, className = '' }) {
  return (
    <motion.section
      {...fadeUp}
      className={`v2-surface p-4 sm:p-5 ${className}`}
    >
      {(title || subtitle || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-tight text-[var(--v2-text)]">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs v2-text-soft">{subtitle}</p>}
          </div>
          {right ? <div>{right}</div> : null}
        </header>
      )}
      {children}
    </motion.section>
  );
}
