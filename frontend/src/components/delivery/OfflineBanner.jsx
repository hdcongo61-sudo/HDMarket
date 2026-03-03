import React from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ offline = false }) {
  if (!offline) return null;
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top,0px)+72px)] z-40 mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm">
      <p className="inline-flex items-center gap-1.5">
        <WifiOff size={13} /> Mode hors ligne. Les actions sont temporairement désactivées.
      </p>
    </div>
  );
}
