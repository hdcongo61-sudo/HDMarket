import React from 'react';
import { resolveGlassVariantClass } from './glassVariants';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function GlassCard({
  as: Component = 'section',
  variant = 'glass',
  interactive = false,
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={join(
        'rounded-2xl p-4 shadow-sm transition-all duration-200',
        resolveGlassVariantClass(variant),
        interactive ? 'hover:shadow-md active:scale-[0.98]' : '',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
