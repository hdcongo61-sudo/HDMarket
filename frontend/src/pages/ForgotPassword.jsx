import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import AuthTrustPanel from '../components/auth/AuthTrustPanel';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';

const SLOW_NETWORK_MS = 8000;

const mapForgotErrorMessage = (error, scope = 'send', isFrench = true) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'Connexion lente. Veuillez réessayer.' : 'Network is slow. Please retry.';
  }

  if (scope === 'send') {
    if (status === 404 || rawMessage.includes('not found') || rawMessage.includes('introuvable')) {
      return isFrench ? 'Aucun compte trouvé avec cet email.' : 'No account found with this email.';
    }
    return isFrench
      ? 'Impossible d’envoyer le code pour le moment. Veuillez réessayer.'
      : 'Unable to send code right now. Please retry.';
  }

  if (status === 400 || status === 401 || rawMessage.includes('code') || rawMessage.includes('invalid')) {
    return isFrench
      ? 'Code invalide ou expiré. Veuillez vérifier puis réessayer.'
      : 'Invalid or expired code. Please check and retry.';
  }
  if (status >= 500) {
    return isFrench
      ? 'Service temporairement indisponible. Veuillez réessayer.'
      : 'Service temporarily unavailable. Please retry.';
  }
  return isFrench
    ? 'Impossible de réinitialiser le mot de passe pour le moment.'
    : 'Unable to reset password right now.';
};

const getPasswordChecks = (password = '') => {
  const value = String(password || '');
  return {
    minLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasNumber: /\d/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value)
  };
};

const strengthLabelOf = (score) => {
  if (score <= 1) return { label: 'Faible', color: 'bg-red-500' };
  if (score === 2) return { label: 'Moyen', color: 'bg-amber-500' };
  if (score === 3) return { label: 'Bon', color: 'bg-blue-500' };
  return { label: 'Fort', color: 'bg-emerald-500' };
};

export default function ForgotPassword() {
  const { language } = useAppSettings();
  const navigate = useNavigate();
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');
  const copy = {
    appBadge: 'HDMarket',
    title: isFrench ? 'Réinitialiser votre mot de passe' : 'Reset your password',
    subtitle: isFrench
      ? 'Recevez un code par email puis définissez un nouveau mot de passe sécurisé.'
      : 'Receive a code by email, then set a new secure password.',
    stepCode: isFrench ? 'Étape 1 : Code' : 'Step 1: Code',
    stepReset: isFrench ? 'Étape 2 : Réinitialiser' : 'Step 2: Reset',
    email: isFrench ? 'Adresse email' : 'Email address',
    emailPlaceholder: isFrench ? 'nom@email.com' : 'name@email.com',
    sendCode: isFrench ? 'Envoyer le code' : 'Send code',
    resendCode: isFrench ? 'Renvoyer le code' : 'Resend code',
    sending: isFrench ? 'Envoi...' : 'Sending...',
    hasCode: isFrench ? "J'ai déjà un code" : 'I already have a code',
    verificationCode: isFrench ? 'Code de vérification' : 'Verification code',
    codePlaceholder: isFrench ? 'Code reçu par email' : 'Code received by email',
    newPassword: isFrench ? 'Nouveau mot de passe' : 'New password',
    newPasswordPlaceholder: isFrench ? 'Votre nouveau mot de passe' : 'Your new password',
    confirmPassword: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    confirmPasswordPlaceholder: isFrench ? 'Confirmer le mot de passe' : 'Confirm password',
    showPassword: isFrench ? 'Afficher le mot de passe' : 'Show password',
    hidePassword: isFrench ? 'Masquer le mot de passe' : 'Hide password',
    passwordStrength: isFrench ? 'Force du mot de passe' : 'Password strength',
    ruleLength: isFrench ? 'Au moins 8 caractères' : 'At least 8 characters',
    ruleUpper: isFrench ? 'Une majuscule' : 'Uppercase letter',
    ruleNumber: isFrench ? 'Un chiffre' : 'Number',
    ruleSymbol: isFrench ? 'Un symbole (optionnel)' : 'Symbol (optional)',
    back: isFrench ? 'Retour' : 'Back',
    updatePassword: isFrench ? 'Mettre à jour le mot de passe' : 'Update password',
    updating: isFrench ? 'Confirmation...' : 'Confirming...',
    backToLogin: isFrench ? 'Retour à la connexion' : 'Back to sign in',
    codeSent: isFrench
      ? 'Code envoyé par email. Vérifiez votre boîte de réception.'
      : 'Code sent by email. Check your inbox.',
    slowNetwork: isFrench ? 'Réseau lent, veuillez réessayer.' : 'Network is slow, please retry.',
    passwordUpdated: isFrench ? 'Mot de passe mis à jour' : 'Password updated',
    passwordUpdatedDesc: isFrench
      ? 'Votre mot de passe a été réinitialisé avec succès.'
      : 'Your password has been reset successfully.',
    redirecting: isFrench ? 'Redirection vers la connexion...' : 'Redirecting to login...',
    signInNow: isFrench ? 'Se connecter maintenant' : 'Sign in now',
    emailRequired: isFrench ? 'Veuillez saisir votre adresse email.' : 'Please enter your email address.',
    codeRequired: isFrench
      ? 'Veuillez saisir le code reçu par email.'
      : 'Please enter the code received by email.',
    passwordRequired: isFrench
      ? 'Veuillez saisir un nouveau mot de passe.'
      : 'Please enter a new password.',
    rulesError: isFrench
      ? 'Le mot de passe doit contenir 8 caractères, une majuscule et un chiffre.'
      : 'Password must include 8 characters, one uppercase letter and one number.',
    mismatch: isFrench ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.'
  };
  const [form, setForm] = useState({
    email: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [codeSending, setCodeSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowNetwork, setSlowNetwork] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const slowNetworkTimerRef = useRef(null);
  const redirectTimerRef = useRef(null);

  const passwordChecks = useMemo(() => getPasswordChecks(form.newPassword), [form.newPassword]);
  const passwordScore = [
    passwordChecks.minLength,
    passwordChecks.hasUppercase,
    passwordChecks.hasNumber,
    passwordChecks.hasSymbol
  ].filter(Boolean).length;
  const passwordStrength = strengthLabelOf(passwordScore);
  const passwordStrengthLabel = {
    Faible: isFrench ? 'Faible' : 'Weak',
    Moyen: isFrench ? 'Moyen' : 'Medium',
    Bon: isFrench ? 'Bon' : 'Good',
    Fort: isFrench ? 'Fort' : 'Strong'
  }[passwordStrength.label] || passwordStrength.label;

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    redirectTimerRef.current = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 1500);
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [success, navigate]);

  const sendCode = async () => {
    if (!form.email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    setCodeSending(true);
    setError('');
    setMessage('');
    setSlowNetwork('');
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork('send'), SLOW_NETWORK_MS);
    try {
      await api.post('/auth/password/forgot', { email: form.email });
      setCodeSent(true);
      setStep(2);
      setMessage(copy.codeSent);
    } catch (err) {
      setError(mapForgotErrorMessage(err, 'send', isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setCodeSending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || success) return;

    setError('');
    setMessage('');
    setSlowNetwork('');

    if (!form.email.trim()) {
      setError(copy.emailRequired);
      return;
    }
    if (!form.verificationCode.trim()) {
      setError(copy.codeRequired);
      return;
    }
    if (!form.newPassword) {
      setError(copy.passwordRequired);
      return;
    }
    if (!passwordChecks.minLength || !passwordChecks.hasUppercase || !passwordChecks.hasNumber) {
      setError(copy.rulesError);
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError(copy.mismatch);
      return;
    }

    setLoading(true);
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork('reset'), SLOW_NETWORK_MS);

    try {
      await api.post('/auth/password/reset', {
        email: form.email,
        verificationCode: form.verificationCode.trim(),
        newPassword: form.newPassword
      });
      setSuccess(true);
    } catch (err) {
      setError(mapForgotErrorMessage(err, 'reset', isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setLoading(false);
    }
  };

  return (
    <main className="glass-page-shell min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:gap-6">
          <section className="glass-card rounded-3xl p-5 shadow-sm sm:p-7">
            {success ? (
              <AuthSuccessCard
                variant="login"
                loading
                title={copy.passwordUpdated}
                description={copy.passwordUpdatedDesc}
                statusText={copy.redirecting}
                actions={[
                  {
                    key: 'go-login',
                    label: copy.signInNow,
                    primary: true,
                    onClick: () => navigate('/login', { replace: true })
                  }
                ]}
              />
            ) : (
              <>
                <header className="mb-6">
                  <p className="inline-flex items-center gap-2 rounded-full soft-card soft-card-blue px-3 py-1 text-xs font-semibold text-blue-900 dark:text-blue-100">
                    <ShieldCheck size={14} />
                    {copy.appBadge}
                  </p>
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    {copy.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{copy.subtitle}</p>
                </header>

                <div className="mb-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                      step === 1
                        ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                        : 'glass-card text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {copy.stepCode}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                      step === 2
                        ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                        : 'glass-card text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {copy.stepReset}
                  </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {error ? (
                    <div className="soft-card soft-card-red rounded-2xl px-3 py-2.5 text-sm text-red-700 dark:text-red-100">
                      {error}
                    </div>
                  ) : null}

                  {message ? (
                    <div className="soft-card soft-card-green rounded-2xl px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-100">
                      {message}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label htmlFor="forgot-email" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {copy.email}
                    </label>
                    <div className="relative">
                      <input
                        id="forgot-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className="ui-input min-h-[48px] w-full rounded-xl px-3 pl-11 text-sm"
                        placeholder={copy.emailPlaceholder}
                        value={form.email}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, email: e.target.value }));
                          setError('');
                        }}
                        required
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={codeSending || !form.email.trim()}
                    className="glass-card min-h-[48px] w-full rounded-xl px-4 text-sm font-semibold text-slate-700 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100"
                  >
                    {codeSending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {copy.sending}
                      </span>
                    ) : codeSent ? (
                      copy.resendCode
                    ) : (
                      copy.sendCode
                    )}
                  </button>

                  {slowNetwork === 'send' && codeSending ? (
                    <p className="text-xs text-amber-700 dark:text-amber-200">{copy.slowNetwork}</p>
                  ) : null}

                  {step === 1 ? (
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="soft-card soft-card-purple inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-purple-900 dark:text-purple-100"
                    >
                      {copy.hasCode}
                    </button>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-code" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {copy.verificationCode}
                        </label>
                        <div className="relative">
                          <input
                            id="forgot-code"
                            autoComplete="one-time-code"
                            className="ui-input min-h-[48px] w-full rounded-xl px-3 pl-11 text-sm"
                            placeholder={copy.codePlaceholder}
                            value={form.verificationCode}
                            onChange={(e) => {
                              setForm((prev) => ({ ...prev, verificationCode: e.target.value }));
                              setError('');
                            }}
                            required
                          />
                          <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label htmlFor="forgot-password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.newPassword}
                          </label>
                          <div className="relative">
                            <input
                              id="forgot-password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded-xl px-3 pl-11 pr-12 text-sm"
                              placeholder={copy.newPasswordPlaceholder}
                              value={form.newPassword}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, newPassword: e.target.value }));
                                setError('');
                              }}
                              required
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <button
                              type="button"
                              onClick={() => setShowPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg glass-card text-slate-600 dark:text-slate-200"
                              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="forgot-confirm-password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {copy.confirmPassword}
                          </label>
                          <div className="relative">
                            <input
                              id="forgot-confirm-password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              className="ui-input min-h-[48px] w-full rounded-xl px-3 pl-11 pr-12 text-sm"
                              placeholder={copy.confirmPasswordPlaceholder}
                              value={form.confirmPassword}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                                setError('');
                              }}
                              required
                            />
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg glass-card text-slate-600 dark:text-slate-200"
                              aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                            >
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <section className="glass-card rounded-2xl p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                            {copy.passwordStrength}
                          </p>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                            {passwordStrengthLabel}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/55 dark:bg-slate-800">
                          <div
                            className={`h-full ${passwordStrength.color} transition-all`}
                            style={{ width: `${Math.max(8, (passwordScore / 4) * 100)}%` }}
                          />
                        </div>
                        <ul className="mt-3 space-y-1 text-xs">
                          <li className={passwordChecks.minLength ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleLength}
                          </li>
                          <li className={passwordChecks.hasUppercase ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleUpper}
                          </li>
                          <li className={passwordChecks.hasNumber ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-600 dark:text-slate-300'}>
                            • {copy.ruleNumber}
                          </li>
                          <li className={passwordChecks.hasSymbol ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-500 dark:text-slate-300'}>
                            • {copy.ruleSymbol}
                          </li>
                        </ul>
                      </section>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="glass-card min-h-[48px] rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-100"
                        >
                          {copy.back}
                        </button>
                        <button
                          type="submit"
                          disabled={
                            loading ||
                            !form.email.trim() ||
                            !form.verificationCode.trim() ||
                            !form.newPassword ||
                            !form.confirmPassword
                          }
                          className="soft-card soft-card-purple inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-purple-900 disabled:opacity-60 dark:text-purple-100"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                          {loading ? copy.updating : copy.updatePassword}
                        </button>
                      </div>

                      {slowNetwork === 'reset' && loading ? (
                        <p className="text-xs text-amber-700 dark:text-amber-200">{copy.slowNetwork}</p>
                      ) : null}
                    </>
                  )}
                </form>

                <footer className="mt-6 border-t border-white/35 pt-4 text-sm text-slate-600 dark:text-slate-300">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 font-semibold text-slate-800 hover:underline dark:text-white"
                  >
                    <ArrowLeft size={16} />
                    {copy.backToLogin}
                  </Link>
                </footer>
              </>
            )}

            {!success ? <AuthTrustPanel compact /> : null}
          </section>

          <AuthTrustPanel />
        </div>
      </div>
    </main>
  );
}
