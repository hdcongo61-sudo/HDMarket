import React from 'react';
import { Loader2 } from 'lucide-react';
import cn from '../../lib/utils';

const VARIANT_CLASSES = {
  default:
    'border border-[#ff6a00] bg-gradient-to-b from-[#ff8a1f] to-[#ff5a1f] text-white shadow-[0_12px_26px_rgba(255,106,0,0.24)] hover:from-[#ff7c0a] hover:to-[#e85f00] dark:border-[#ff8a1f] dark:from-[#ff8a1f] dark:to-[#ff5a1f] dark:text-white',
  destructive:
    'border border-red-600 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.18)] hover:bg-red-700',
  outline:
    'border border-gray-200 bg-white/90 text-slate-900 shadow-sm backdrop-blur hover:border-gray-200 hover:bg-gray-100 dark:border-orange-900/60 dark:bg-neutral-950/88 dark:text-neutral-100 dark:hover:bg-orange-950/20',
  secondary:
    'border border-gray-200 bg-[#fff0e4] text-gray-500 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-100 dark:hover:bg-orange-950/40',
  ghost:
    'border border-transparent text-slate-800 hover:bg-gray-100 hover:text-[#b45100] dark:text-neutral-100 dark:hover:bg-orange-950/25',
  link: 'border border-transparent text-[#FF6A00] underline-offset-4 hover:underline dark:text-orange-200'
};

const SIZE_CLASSES = {
  default: 'min-h-[46px] px-4 py-2.5',
  sm: 'min-h-[40px] px-3 py-2 text-xs',
  lg: 'min-h-[52px] px-6 py-3 text-base',
  icon: 'h-11 w-11 p-0'
};

export function buttonVariants({ variant = 'default', size = 'default', className = '' } = {}) {
  return cn(
    'ui-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background',
    'transition-all duration-200 ease-out active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-300/30',
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
