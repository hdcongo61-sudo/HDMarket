import React, { useState } from 'react';
import { CheckCircle2, Mail, Plus, ShieldCheck } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const hasEmail = Boolean(user?.email);
  const isVerified = Boolean(user?.emailVerified);

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
          <Mail size={17} />
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
              <CheckCircle2 size={13} /> Vérifié
            </span>
          ) : (
            <button
              type="button"
              onClick={() => { setShowForm(true); setAwaitingVerification(true); }}
              className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
            >
              Non vérifié · Vérifier
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
            <Plus size={16} /> Ajouter mon adresse email
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
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-100">
            <ShieldCheck size={14} /> Code de vérification envoyé à {user?.email}
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
