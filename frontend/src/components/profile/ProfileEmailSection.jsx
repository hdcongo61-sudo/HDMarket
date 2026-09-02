import React, { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, EnvelopeIcon, PlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

// Dedicated "Email" section for the profile: shows the current state (none /
// unverified / verified) and owns the "+ Add Email Address" popover, kept
// separate from the generic profile-info form so it can run its own
// validate -> save -> verify flow without touching the rest of the form.
export default function ProfileEmailSection({ user, onUserUpdated, sectionId = 'profile-email-section' }) {
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const resendTimerRef = useRef(null);

  const hasEmail = Boolean(user?.email);
  const isVerified = Boolean(user?.emailVerified);

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

  // The "Non vérifié · Vérifier" badge and the in-form "Renvoyer" link both
  // land here: re-adding the same email is how the backend resends a fresh
  // code (addProfileEmail is idempotent for the owning user). Without this,
  // clicking "Vérifier" only reopened the code box without ever requesting a
  // new code — a dead end once the original 10-minute code expired.
  const resendCode = async () => {
    if (!user?.email || resending || resendIn > 0) return;
    setResending(true);
    setVerifyError('');
    try {
      const { data } = await api.post('/users/profile/email', { email: user.email });
      onUserUpdated?.(data.user);
      setShowForm(true);
      setAwaitingVerification(true);
      startResendCooldown();
      if (data.verificationSent) {
        showToast(data.message || 'Code envoyé par email.', { variant: 'success' });
      } else {
        showToast(data.message || 'Adresse email déjà enregistrée.', { variant: 'info' });
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Impossible d’envoyer le code de vérification.'), { variant: 'error' });
    } finally {
      setResending(false);
    }
  };

  const submitEmail = async (event) => {
    event.preventDefault();
    const trimmed = emailDraft.trim().toLowerCase();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setFormError('Adresse email invalide.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const { data } = await api.post('/users/profile/email', { email: trimmed });
      onUserUpdated?.(data.user);
      setEmailDraft('');
      if (data.verificationSent) {
        setAwaitingVerification(true);
        startResendCooldown();
        showToast(data.message || 'Adresse email ajoutée. Un code de vérification a été envoyé.', { variant: 'success' });
      } else {
        setShowForm(false);
        showToast('✅ Votre email a été ajouté avec succès. Votre compte est maintenant plus sécurisé.', { variant: 'success' });
      }
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Impossible d’ajouter cette adresse email.'));
    } finally {
      setSaving(false);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verificationCode.trim()) return;
    setVerifying(true);
    setVerifyError('');
    try {
      const { data } = await api.post('/users/profile/email/verify', { verificationCode: verificationCode.trim() });
      onUserUpdated?.(data.user);
      setAwaitingVerification(false);
      setShowForm(false);
      setVerificationCode('');
      showToast('✅ Votre email a été ajouté avec succès. Votre compte est maintenant plus sécurisé.', { variant: 'success' });
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
          <EnvelopeIcon className="h-[17px] w-[17px]" />
        </span>
        <h2 className="text-[15px] font-black text-gray-900 dark:text-white">Email</h2>
      </div>

      {hasEmail && !showForm ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-slate-100">
            {user.email}
          </span>
          {isVerified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircleIcon className="h-[13px] w-[13px]" /> Vérifié
            </span>
          ) : (
            <button
              type="button"
              onClick={resendCode}
              disabled={resending}
              className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-500/10 dark:text-amber-300"
            >
              {resending ? 'Envoi...' : 'Non vérifié · Vérifier'}
            </button>
          )}
        </div>
      ) : null}

      {!hasEmail && !showForm ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Aucun email ajouté pour le moment.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white transition hover:bg-[#d45400] sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" /> Ajouter mon adresse email
          </button>
        </div>
      ) : null}

      {showForm && !awaitingVerification ? (
        <form onSubmit={submitEmail} className="mt-3 space-y-2.5">
          <label htmlFor="add-email-input" className="text-xs font-semibold text-gray-600 dark:text-slate-300">
            Adresse email
          </label>
          <input
            id="add-email-input"
            type="email"
            autoComplete="email"
            autoFocus
            className="ui-input min-h-11 w-full rounded-xl px-3 text-sm"
            placeholder="nom@email.com"
            value={emailDraft}
            onChange={(e) => { setEmailDraft(e.target.value); setFormError(''); }}
          />
          {formError ? <p className="text-xs font-semibold text-red-600 dark:text-red-300">{formError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEmailDraft(''); setFormError(''); }}
              className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !emailDraft.trim()}
              className="min-h-11 flex-1 rounded-xl bg-[#e85d00] text-sm font-black text-white transition hover:bg-[#d45400] disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      ) : null}

      {awaitingVerification ? (
        <form onSubmit={submitVerification} className="mt-3 space-y-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-100">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Code envoyé à {user?.email}
            </div>
            <button
              type="button"
              onClick={resendCode}
              disabled={resending || resendIn > 0}
              className="shrink-0 text-[12px] font-semibold text-[#b3480a] transition enabled:hover:text-[#e85d00] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {resending ? 'Envoi...' : resendIn > 0 ? `Renvoyer dans ${resendIn}s` : 'Renvoyer'}
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
              onClick={() => { setAwaitingVerification(false); setShowForm(false); setVerificationCode(''); }}
              className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-slate-200"
            >
              PlusIcon tard
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
