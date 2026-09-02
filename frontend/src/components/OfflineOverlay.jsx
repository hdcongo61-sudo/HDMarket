import React, { useEffect, useState } from 'react';
import { ArrowUturnRightIcon, ChevronDownIcon, ChevronUpIcon, SparklesIcon, WifiIcon } from '@heroicons/react/24/outline';

const OFFLINE_MOODS = [
  { emoji: '🛶', title: 'Mode aventure activé' },
  { emoji: '😴', title: 'Le réseau fait une petite sieste' },
  { emoji: '🧺', title: 'Vos trouvailles restent avec vous' },
  { emoji: '🦒', title: 'Même la girafe cherche du réseau' }
];

const pickOfflineMood = () => OFFLINE_MOODS[Math.floor(Math.random() * OFFLINE_MOODS.length)];

// Connectivity feedback stays deliberately compact so cached pages remain usable.
export default function OfflineOverlay() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [expanded, setExpanded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [checking, setChecking] = useState(false);
  const [mood, setMood] = useState(pickOfflineMood);
  const [hint, setHint] = useState('');

  useEffect(() => {
    let restoredTimer;
    const handleOnline = () => {
      setOffline((wasOffline) => {
        if (wasOffline) {
          setRestored(true);
          window.clearTimeout(restoredTimer);
          restoredTimer = window.setTimeout(() => setRestored(false), 3200);
        }
        return false;
      });
      setChecking(false);
      setExpanded(false);
      setHint('');
    };
    const handleOffline = () => {
      setMood(pickOfflineMood());
      setOffline(true);
      setRestored(false);
    };
    const handleCacheHit = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('hdmarket:offline-cache-hit', handleCacheHit);
    return () => {
      window.clearTimeout(restoredTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('hdmarket:offline-cache-hit', handleCacheHit);
    };
  }, []);

  const handleCheckConnection = () => {
    setChecking(true);
    setHint('');
    window.setTimeout(() => {
      const stillOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setChecking(false);
      if (stillOffline) {
        setHint('Toujours pas de réseau, mais vous pouvez continuer à explorer ✨');
        return;
      }
      window.dispatchEvent(new Event('online'));
    }, 700);
  };

  if (!offline && !restored) return null;

  if (restored) {
    return (
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[400] flex justify-center sm:bottom-5">
        <div
          role="status"
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-xl shadow-emerald-900/20"
        >
          <WifiIcon className="h-[17px] w-[17px]" />
          Connexion retrouvée
          <SparklesIcon className="animate-pulse h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[400] flex justify-center sm:bottom-5">
      <section
        aria-live="polite"
        className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/95 text-slate-900 shadow-2xl shadow-slate-950/15 backdrop-blur-md dark:border-amber-900/60 dark:bg-neutral-900/95 dark:text-white"
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left"
          aria-expanded={expanded}
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <WifiIcon className="h-[18px] w-[18px]" />
            <span className="absolute -right-1 -top-1 text-base motion-safe:animate-bounce" aria-hidden="true">
              {mood.emoji}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black">{mood.title}</span>
            <span className="block truncate text-xs font-semibold text-slate-600 dark:text-neutral-300">
              Mode hors ligne · contenu enregistré disponible
            </span>
          </span>
          {expanded ? <ChevronDownIcon className="h-[18px] w-[18px]" /> : <ChevronUpIcon className="h-[18px] w-[18px]" />}
        </button>

        {expanded && (
          <div className="border-t border-amber-200/80 px-4 pb-4 pt-3 dark:border-amber-900/60">
            <p className="text-xs font-semibold leading-5 text-slate-600 dark:text-neutral-300">
              Continuez à parcourir les pages déjà visitées. Les prix et disponibilités affichés peuvent dater de votre dernière connexion.
            </p>
            {hint && <p className="mt-2 text-xs font-black text-amber-800 dark:text-amber-300">{hint}</p>}
            <button
              type="button"
              onClick={handleCheckConnection}
              disabled={checking}
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              <ArrowUturnRightIcon className={`h-[15px] w-[15px] ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Vérification…' : 'Vérifier la connexion'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
