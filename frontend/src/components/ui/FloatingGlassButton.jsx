import React from 'react';
import { resolveGlassVariantClass } from './glassVariants';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function FloatingGlassButton({
  icon: Icon = null,
  label = '',
  variant = 'glass',
  className = '',
  iconClassName = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={join(
        'floating-glass-button min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg',
        'inline-flex items-center justify-center gap-2 active:scale-95 transition-all duration-200',
        resolveGlassVariantClass(variant),
        className
      )}
      {...props}
    >
      {Icon ? <Icon size={18} className={join('shrink-0', iconClassName)} /> : null}
      {label ? <span className="truncate">{label}</span> : null}
    </button>
  );
}
