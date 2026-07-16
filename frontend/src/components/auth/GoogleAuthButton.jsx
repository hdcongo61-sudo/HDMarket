import React from 'react';
import { Loader2 } from 'lucide-react';

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.7c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.8A10.1 10.1 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.5 13.8A6.1 6.1 0 0 1 6.2 12c0-.6.1-1.2.3-1.8V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6l3.4-2.8Z" />
    <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10.1 10.1 0 0 0-8.9 5.4l3.4 2.8A5.9 5.9 0 0 1 12 6.1Z" />
  </svg>
);

export default function GoogleAuthButton({ label, loading = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border border-[#d8d2c8] bg-white px-4 text-[15px] font-black text-[#231f1b] transition hover:border-[#aaa196] hover:bg-[#faf8f5] disabled:cursor-wait disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
    >
      {loading ? <Loader2 size={19} className="animate-spin" /> : <GoogleMark />}
      {label}
    </button>
  );
}
