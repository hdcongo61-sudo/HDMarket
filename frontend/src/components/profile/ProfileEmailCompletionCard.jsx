import React, { useEffect, useState } from 'react';
import { EnvelopeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { storage } from '../../utils/storage';

const DISMISS_DAYS = 7;

const dismissKeyFor = (userId) => `hdmarket:email-card-dismissed-until:${userId || 'anon'}`;

// Premium, dismissible nudge shown at the top of the profile while the
// account has no email. Dismissing hides it for 7 days; it never shows
// again once an email is added.
export default function ProfileEmailCompletionCard({ user, onAddEmail }) {
  const [dismissedUntil, setDismissedUntil] = useState(null);
  const [ready, setReady] = useState(false);
  const userId = user?._id || user?.id;

  useEffect(() => {
    let active = true;
    storage.get(dismissKeyFor(userId)).then((value) => {
      if (!active) return;
      setDismissedUntil(value ? Number(value) : null);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const hasEmail = Boolean(user?.email);
  const isDismissed = Boolean(dismissedUntil && Date.now() < dismissedUntil);

  if (hasEmail || !ready || isDismissed) return null;

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    setDismissedUntil(until);
    storage.set(dismissKeyFor(userId), String(until));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-amber-50 p-4 shadow-sm dark:border-sky-900/40 dark:from-sky-950/30 dark:via-neutral-950 dark:to-amber-950/20 sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10"
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm ring-1 ring-sky-100 dark:bg-neutral-900 dark:text-sky-300 dark:ring-sky-900/40">
          <EnvelopeIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-gray-900 dark:text-white">
            📧 Protégez votre compte
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-neutral-300">
            Ajoutez votre adresse email pour sécuriser davantage votre compte et le récupérer plus facilement en cas de perte de votre téléphone.
          </p>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-1.5 pl-[3.5rem] text-[12.5px] font-medium text-gray-600 dark:text-neutral-300 sm:grid-cols-2">
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Récupérez votre compte plus facilement</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Recevez les mises à jour de commandes</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Recevez les alertes de sécurité importantes</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Ne perdez jamais l’accès à vos achats</li>
      </ul>

      <div className="mt-4 pl-[3.5rem]">
        <button
          type="button"
          onClick={onAddEmail}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d45400] active:scale-[0.98]"
        >
          <EnvelopeIcon className="h-[15px] w-[15px]" /> Ajouter mon email
        </button>
      </div>
    </div>
  );
}
