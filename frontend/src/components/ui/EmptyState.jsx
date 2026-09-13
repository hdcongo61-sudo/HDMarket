import React from 'react';

/**
 * Shared empty-state block (Taobao-style "no dead ends"): icon + title + hint
 * + optional primary action. Buyer-facing pages only.
 */
export default function EmptyState({ icon: Icon = null, title = '', hint = '', actionLabel = '', onAction = null, to = null, children = null }) {
  const action = onAction && actionLabel ? (
    <button
      type="button"
      onClick={onAction}
      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#e85d00] px-5 text-xs font-black text-white transition active:scale-[0.97]"
    >
      {actionLabel}
    </button>
  ) : null;

  const actionLink = to && actionLabel ? (
    <a
      href={to}
      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#e85d00] px-5 text-xs font-black text-white transition active:scale-[0.97]"
    >
      {actionLabel}
    </a>
  ) : null;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon ? (
        <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
          <Icon className="h-7 w-7" />
        </span>
      ) : null}
      {title ? <h3 className="mt-4 text-sm font-black text-neutral-900 dark:text-neutral-100">{title}</h3> : null}
      {hint ? <p className="mt-1 max-w-xs text-xs leading-5 text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
      {action}
      {actionLink}
      {children}
    </div>
  );
}
