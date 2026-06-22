import React from 'react';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function GlassHeader({
  title,
  subtitle,
  sticky = false,
  className = '',
  children,
  titleClassName = '',
  subtitleClassName = ''
}) {
  return (
    <header
      className={join(
        'glass-header rounded-2xl px-4 py-3 shadow-sm sm:px-5 sm:py-4',
        sticky ? 'sticky top-0 z-30' : '',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title ? (
            <h1 className={join('truncate text-lg font-semibold text-slate-900 dark:text-white', titleClassName)}>
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className={join(
                'mt-1 text-xs text-slate-600 dark:text-slate-300 sm:text-sm',
                subtitleClassName
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
