import React from 'react';
import cn from '../../lib/utils';

export function FormSection({ className = '', children, ...props }) {
  return (
    <section className={cn('ui-form-section rounded-2xl border p-4 sm:p-5', className)} {...props}>
      {children}
    </section>
  );
}

export function FormGrid({ className = '', children, ...props }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)} {...props}>
      {children}
    </div>
  );
}

export function FormField({ className = '', children, ...props }) {
  return (
    <div className={cn('ui-form-field space-y-1.5', className)} {...props}>
      {children}
    </div>
  );
}

export function Label({ className = '', children, ...props }) {
  return (
    <label className={cn('ui-label block text-sm font-semibold text-neutral-800 dark:text-neutral-200', className)} {...props}>
      {children}
    </label>
  );
}

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={cn('ui-input w-full', className)} {...props} />;
});

export const Textarea = React.forwardRef(function Textarea({ className = '', rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn('ui-input w-full resize-y', className)} {...props} />;
});

export const Select = React.forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={cn('ui-input w-full appearance-none', className)} {...props}>
      {children}
    </select>
  );
});

export function FieldHint({ className = '', children, ...props }) {
  if (!children) return null;
  return (
    <p className={cn('text-xs leading-5 text-neutral-500 dark:text-neutral-400', className)} {...props}>
      {children}
    </p>
  );
}

export function FieldError({ className = '', children, ...props }) {
  if (!children) return null;
  return (
    <p className={cn('text-xs font-medium leading-5 text-red-600 dark:text-red-300', className)} {...props}>
      {children}
    </p>
  );
}
