import React from 'react';
import { Loader2 } from 'lucide-react';

const AppleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
    <path d="M17.1 12.6c0-2.6 2.1-3.9 2.2-4a4.7 4.7 0 0 0-3.7-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.5 1.2 10 .9 1.2 1.9 2.6 3.3 2.5 1.3 0 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5a10.9 10.9 0 0 0 1.4-2.9 4.4 4.4 0 0 1-3-3.6ZM14.6 4.9a4.4 4.4 0 0 0 1-3.2 4.5 4.5 0 0 0-3 1.5 4.2 4.2 0 0 0-1.1 3.1 3.8 3.8 0 0 0 3.1-1.4Z" />
  </svg>
);

export default function AppleAuthButton({ label, loading = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full bg-black px-4 text-[15px] font-black text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60 dark:border dark:border-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
    >
      {loading ? <Loader2 size={19} className="animate-spin" /> : <AppleMark />}
      {label}
    </button>
  );
}
