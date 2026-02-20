import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function GlassHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Retour',
  right,
  className = ''
}) {
  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`sticky top-0 z-30 border-b border-neutral-200/70 bg-white/75 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/75 ${className}`.trim()}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {backTo && (
              <Link
                to={backTo}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                aria-label={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100 sm:text-base">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : <div className="h-9 w-9" />}
      </div>
    </motion.header>
  );
}
