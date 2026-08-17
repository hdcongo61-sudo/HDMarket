import React, { useEffect, useState } from 'react';
import { Phone, X } from 'lucide-react';
import { storage } from '../../utils/storage';

const DISMISS_DAYS = 3;

const dismissKeyFor = (userId) => `hdmarket:phone-card-dismissed-until:${userId || 'anon'}`;

// Premium, dismissible nudge shown at the top of the profile while the
// account's phone is unverified (possible since SMS verification can be
// turned off at registration via registration_sms_verification_required).
// Dismissing hides it for 3 days; it never shows again once verified.
export default function ProfilePhoneCompletionCard({ user, onVerifyPhone }) {
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

  const isVerified = Boolean(user?.phoneVerified);
  const isDismissed = Boolean(dismissedUntil && Date.now() < dismissedUntil);

  if (isVerified || !ready || isDismissed) return null;

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    setDismissedUntil(until);
    storage.set(dismissKeyFor(userId), String(until));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-neutral-950 dark:to-orange-950/20 sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-white/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm ring-1 ring-amber-100 dark:bg-neutral-900 dark:text-amber-300 dark:ring-amber-900/40">
          <Phone size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-gray-900 dark:text-white">
            📱 Vérifiez votre numéro
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-gray-600 dark:text-neutral-300">
            Votre numéro de téléphone n’est pas encore vérifié. Certaines actions restent bloquées tant que ce n’est pas fait.
          </p>
        </div>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-1.5 pl-[3.5rem] text-[12.5px] font-medium text-gray-600 dark:text-neutral-300 sm:grid-cols-2">
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Devenir boutique</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Devenir livreur</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Recevoir vos versements</li>
        <li className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span> Sécuriser votre compte</li>
      </ul>

      <div className="mt-4 pl-[3.5rem]">
        <button
          type="button"
          onClick={onVerifyPhone}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#d45400] active:scale-[0.98]"
        >
          <Phone size={15} /> Vérifier mon numéro
        </button>
      </div>
    </div>
  );
}
