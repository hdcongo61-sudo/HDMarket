import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

// Full-screen takeover shown while the browser reports no connectivity.
// Appears/disappears automatically on the window online/offline events.
export default function OfflineOverlay() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center gap-4 bg-white px-8 text-center dark:bg-neutral-950">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-neutral-400">
        <WifiOff size={30} />
      </span>
      <h1 className="text-xl font-black text-gray-900 dark:text-white">Vous êtes hors ligne</h1>
      <p className="max-w-xs text-sm font-medium leading-6 text-gray-500 dark:text-neutral-400">
        Vérifiez votre connexion internet. L’application reprendra automatiquement dès que la connexion sera rétablie.
      </p>
    </div>
  );
}
