import React from 'react';
import GlassCard from './GlassCard';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function SoftColorCard({
  variant = 'blue',
  title = '',
  subtitle = '',
  icon = null,
  actions = null,
  className = '',
  children,
  ...props
}) {
  return (
    <GlassCard variant={variant} className={join('space-y-3', className)} {...props}>
      {title || subtitle || icon || actions ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <p className="text-sm font-semibold truncate">{title}</p> : null}
            {subtitle ? <p className="mt-1 text-xs opacity-80">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {icon}
            {actions}
          </div>
        </div>
      ) : null}
      {children}
    </GlassCard>
  );
}
