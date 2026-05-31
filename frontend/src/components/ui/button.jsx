import React from 'react';
import { Loader2 } from 'lucide-react';
import cn from '../../lib/utils';

const VARIANT_CLASSES = {
  default:
    'border border-neutral-950 bg-neutral-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200',
  destructive:
    'border border-red-600 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.18)] hover:bg-red-700',
  outline:
    'border border-neutral-200 bg-white/88 text-neutral-900 shadow-sm backdrop-blur hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950/88 dark:text-neutral-100 dark:hover:bg-neutral-900',
  secondary:
    'border border-neutral-200 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
  ghost:
    'border border-transparent text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-900',
  link: 'border border-transparent text-neutral-950 underline-offset-4 hover:underline dark:text-white'
};

const SIZE_CLASSES = {
  default: 'min-h-[46px] px-4 py-2.5',
  sm: 'min-h-[40px] px-3 py-2 text-xs',
  lg: 'min-h-[52px] px-6 py-3 text-base',
  icon: 'h-11 w-11 p-0'
};

export function buttonVariants({ variant = 'default', size = 'default', className = '' } = {}) {
  return cn(
    'ui-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[18px] text-sm font-semibold ring-offset-background',
    'transition-all duration-200 ease-out active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 focus-visible:ring-offset-2 dark:focus-visible:ring-white/30',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
    SIZE_CLASSES[size] || SIZE_CLASSES.default,
    className
  );
}

const Button = React.forwardRef(function Button(
  {
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    children,
    loading = false,
    loadingText = '',
    leftIcon = null,
    rightIcon = null,
    disabled,
    ...props
  },
  ref
) {
  const classes = buttonVariants({ variant, size, className });

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      className: cn(classes, children.props?.className)
    });
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      data-loading={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? <Loader2 className="ui-btn-spinner h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
      <span className="min-w-0 truncate">{loading && loadingText ? loadingText : children}</span>
      {!loading ? rightIcon : null}
    </button>
  );
});

export { Button };
