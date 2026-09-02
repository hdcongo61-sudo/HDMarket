import React, { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const RESEND_COOLDOWN_SECONDS = 30;

// Dedicated "PhoneIcon" section for the profile: some accounts are created with
// an unverified phone (SMS verification can be turned off at registration
// via registration_sms_verification_required). Verifying here reuses the
// phone already on file — no phone-change flow, just proof of ownership,
// which unlocks trust-elevating actions like Devenir Boutique or Devenir
// livreur.
export default function ProfilePhoneSection({ user, onUserUpdated, sectionId = 'profile-phone-section' }) {
  const { showToast } = useToast();
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);

  const isVerified = Boolean(user?.phoneVerified);

  useEffect(() => () => clearInterval(resendTimerRef.current), []);

  const startResendCooldown = () => {
    setResendIn(RESEND_COOLDOWN_SECONDS);
    clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendIn((previous) => {
        if (previous <= 1) {
          clearInterval(resendTimerRef.current);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    if (sending || resendIn > 0) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post('/users/profile/phone/send-code', {});
      if (data?.alreadyVerified) {
        onUserUpdated?.({ phoneVerified: true });
        showToast(data.message, { variant: 'success' });
        return;
      }
      setAwaitingVerification(true);
      startResendCooldown();
      showToast(data?.message || 'Code envoyé par SMS.', { variant: 'success' });
    } catch (error) {
      setSendError(getApiErrorMessage(error, 'Impossible d’envoyer le code de vérification.'));
    } finally {
      setSending(false);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verificationCode.trim()) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const { data } = await api.post('/users/profile/phone/verify', { verificationCode: verificationCode.trim() });
      onUserUpdated?.(data.user || { phoneVerified: true });
      setAwaitingVerification(false);
      setVerificationCode('');
      showToast('✅ Numéro vérifié. Vous pouvez maintenant demander à devenir boutique ou livreur.', { variant: 'success' });
    } catch (error) {
      setVerifyError(getApiErrorMessage(error, 'Code de vérification invalide.'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff2e6] text-[#e85d00] ring-1 ring-gray-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-neutral-800">
          <PhoneIcon className="h-[17px] w-[17px]" />
        </span>
        <h2 className="text-[15px] font-black text-gray-900 dark:text-white">Téléphone</h2>
      </div>

      {!awaitingVerification ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
            {user?.phone || '—'}
          </span>
          {isVerified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircleIcon className="h-[13px] w-[13px]" /> Vérifié
            </span>
          ) : (
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-500/10 dark:text-amber-300"
            >
              {sending ? 'Envoi...' : 'Non vérifié · Vérifier'}
            </button>
          )}
        </div>
      ) : null}

      {sendError ? (
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">{sendError}</p>
      ) : null}

      {awaitingVerification ? (
        <form onSubmit={submitVerification} className="mt-3 space-y-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-100">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Code envoyé à {user?.phone}
            </div>
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || resendIn > 0}
              className="shrink-0 text-[12px] font-semibold text-[#b3480a] transition enabled:hover:text-[#e85d00] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {sending ? 'Envoi...' : resendIn > 0 ? `Renvoyer dans ${resendIn}s` : 'Renvoyer'}
            </button>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="ui-input min-h-11 w-full rounded-xl px-3 text-sm"
            placeholder="Entrez le code reçu"
            value={verificationCode}
            onChange={(e) => { setVerificationCode(e.target.value); setVerifyError(''); }}
          />
          {verifyError ? <p className="text-xs font-semibold text-red-600 dark:text-red-300">{verifyError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAwaitingVerification(false); setVerificationCode(''); setVerifyError(''); }}
              className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-slate-200"
            >
              Plus tard
            </button>
            <button
              type="submit"
              disabled={verifying || !verificationCode.trim()}
              className="min-h-11 flex-1 rounded-xl bg-[#e85d00] text-sm font-black text-white transition hover:bg-[#d45400] disabled:opacity-60"
            >
              {verifying ? 'Vérification...' : 'Vérifier'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
