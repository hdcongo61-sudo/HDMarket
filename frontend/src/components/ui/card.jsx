import React from 'react';
import cn from '../../lib/utils';

const CARD_VARIANTS = {
  default: 'ui-card bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100',
  glass: 'glass-card text-neutral-950 dark:text-neutral-100',
  muted: 'ui-card bg-neutral-50 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-100',
  soft: 'soft-card bg-neutral-50/80 text-neutral-950 dark:bg-neutral-900/70 dark:text-neutral-100'
};

export const Card = React.forwardRef(function Card(
  { as: Component = 'section', variant = 'default', interactive = false, className = '', children, ...props },
  ref
) {
  return (
    <Component
      ref={ref}
      className={cn(
        'rounded-2xl border p-4 shadow-sm transition-all duration-200 sm:p-5',
        CARD_VARIANTS[variant] || CARD_VARIANTS.default,
        interactive && 'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
});

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ as: Component = 'h2', className = '', children, ...props }) {
  return (
    <Component className={cn('text-base font-semibold tracking-normal text-neutral-950 dark:text-neutral-100', className)} {...props}>
      {children}
    </Component>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('mt-1 text-sm text-neutral-500 dark:text-neutral-400', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('space-y-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end', className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
