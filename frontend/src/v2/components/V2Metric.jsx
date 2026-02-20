import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion';

export default function V2Metric({ label, value, hint, icon }) {
  return (
    <motion.div {...fadeUp} className="v2-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide v2-text-soft">{label}</p>
        {icon ? <span className="v2-text-soft">{icon}</span> : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs v2-text-soft">{hint}</p> : null}
    </motion.div>
  );
}
