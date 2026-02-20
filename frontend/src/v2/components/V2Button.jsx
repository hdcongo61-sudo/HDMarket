import React from 'react';

const variants = {
  primary:
    'bg-[var(--v2-accent)] text-white border-transparent hover:opacity-90 focus-visible:ring-[var(--v2-accent)]/40',
  secondary:
    'bg-[var(--v2-surface-soft)] text-[var(--v2-text)] border-[var(--v2-line)] hover:bg-[var(--v2-surface)] focus-visible:ring-[var(--v2-accent)]/30',
  ghost:
    'bg-transparent text-[var(--v2-text-soft)] border-transparent hover:bg-[var(--v2-surface-soft)] focus-visible:ring-[var(--v2-accent)]/30',
  danger:
    'bg-[var(--v2-danger)] text-white border-transparent hover:opacity-90 focus-visible:ring-[var(--v2-danger)]/40'
};

export default function V2Button({
  as: Comp = 'button',
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  return (
    <Comp
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold v2-safe-transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 ${
        variants[variant] || variants.primary
      } ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}
