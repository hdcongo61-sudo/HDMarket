import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import {
  Check,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppSettings } from '../context/AppSettingsContext';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import CommerceAuthPanel from '../components/auth/CommerceAuthPanel';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AppleAuthButton from '../components/auth/AppleAuthButton';
import { signInWithApple, signInWithGoogle } from '../services/providerAuth';
import { resolveAuthProviderAvailability } from '../utils/authProviderAvailability';
import { useCountry } from '../context/CountryContext';

const SLOW_NETWORK_MS = 8000;

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05
    }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }
  }
};

const mapLoginErrorMessage = (error, isFrench = true) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.response?.data?.code || error?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'La connexion prend plus de temps que prévu. Réessayez dans un instant.' : 'Sign-in is taking longer than expected. Please try again shortly.';
  }
  if (code === 'ACCOUNT_BLOCKED') {
    return isFrench
      ? 'Votre compte est suspendu. Contactez le support pour obtenir de l’aide.'
      : 'Your account is suspended. Contact support for help.';
  }
  if (code === 'ACCOUNT_INACTIVE') {
    return isFrench
      ? 'Votre compte est désactivé. Contactez le support.'
      : 'Your account is disabled. Contact support.';
  }
  if (code === 'ACCOUNT_LOCKED') {
    return isFrench
      ? 'Votre compte est verrouillé. Contactez le support.'
      : 'Your account is locked. Contact support.';
  }
  if (code === 'ACCOUNT_TEMPORARILY_LOCKED') {
    const minutes = Number(error?.response?.data?.retryAfterMinutes) || 15;
    return isFrench
      ? `Trop de tentatives échouées sur ce compte. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
      : `Too many failed attempts on this account. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
  }
  if (status === 429 || code === 'RATE_LIMIT_ERROR') {
    return isFrench
      ? 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
      : 'Too many sign-in attempts. Try again in 15 minutes.';
  }
  if (status === 401 || code === 'INVALID_CREDENTIALS') {
    return isFrench
      ? "L’adresse email, le numéro de téléphone ou le mot de passe est incorrect, ou ce compte n’existe pas."
      : 'The email address, phone number, or password is incorrect, or this account does not exist.';
  }
  if (status === 403) {
    if (code === 'AUTH_PROVIDER_DISABLED' && error?.response?.data?.message) {
      return error.response.data.message;
    }
    return isFrench
      ? 'La connexion à ce compte est actuellement impossible. Contactez le support.'
      : 'This account cannot currently sign in. Contact support.';
  }
  if (status >= 500) {
    return isFrench
      ? 'Service temporairement indisponible. Veuillez réessayer.'
      : 'Service temporarily unavailable. Please retry.';
  }
  return isFrench
    ? 'Impossible de vous connecter pour le moment. Veuillez réessayer.'
    : 'Unable to sign in right now. Please retry.';
};

export default function Login() {
  const { user, login } = useContext(AuthContext);
  const { language, runtime } = useAppSettings();
  const { country: selectedCountry } = useCountry();
  const { authLogoSrc: logoSrc } = useAppBrandLogo();
  const nav = useNavigate();
  const location = useLocation();
  const from = typeof location.state === 'string'
    ? location.state
    : location.state?.from || '/';
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const slowNetworkTimerRef = useRef(null);

  const [form, setForm] = useState({ phone: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [error, setError] = useState('');
  const [inactiveAccount, setInactiveAccount] = useState(false);
  const [reactivationMessage, setReactivationMessage] = useState('');
  const [reactivationLoading, setReactivationLoading] = useState(false);
  const [reactivationFeedback, setReactivationFeedback] = useState('');
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');
  const authAvailability = useMemo(() => resolveAuthProviderAvailability(runtime), [runtime]);
  const hasProviderLogin = authAvailability.google.login || authAvailability.apple.login;
  const hasRegistration = Object.values(authAvailability).some((provider) => provider.registration);
  const hasLogin = authAvailability.email.login || hasProviderLogin;

  const copy = {
    appBadge: 'HDMarket',
    title: isFrench ? 'Bon retour' : 'Welcome back',
    subtitle: isFrench
      ? 'Connectez-vous pour retrouver vos commandes, vos messages et vos livraisons.'
      : 'Sign in to access your orders, messages, and deliveries.',
    identifierLabel: isFrench ? 'Email ou téléphone' : 'Email or phone',
    identifierPlaceholder: isFrench ? 'nom@email.com ou 060000000' : 'name@email.com or 060000000',
    passwordLabel: isFrench ? 'Mot de passe' : 'Password',
    passwordPlaceholder: isFrench ? 'Votre mot de passe' : 'Your password',
    showPassword: isFrench ? 'Afficher le mot de passe' : 'Show password',
    hidePassword: isFrench ? 'Masquer le mot de passe' : 'Hide password',
    rememberMe: isFrench ? 'Rester connecté' : 'Stay signed in',
    forgotPassword: isFrench ? 'Oublié ?' : 'Forgot?',
    submit: isFrench ? 'Se connecter' : 'Sign in',
    submitting: isFrench ? 'Connexion...' : 'Signing in...',
    divider: isFrench ? 'ou' : 'or',
    google: 'Google',
    apple: 'Apple',
    noAccount: isFrench ? 'Nouveau sur HDMarket ?' : 'New to HDMarket?',
    createAccount: isFrench ? 'Créer un compte' : 'Create account',
    supportLead: isFrench ? 'Besoin d’aide ?' : 'Need help?',
    support: isFrench ? 'Contacter le support' : 'Contact support',
    slowNetwork: isFrench ? 'Connexion en cours, merci de patienter.' : 'Connection in progress, please wait.',
    sessionLabel: isFrench ? 'Session protégée' : 'Protected session',
    secureNote: isFrench
      ? 'Vos commandes, messages et paiements restent liés à votre compte.'
      : 'Your orders, messages, and payments stay connected to your account.',
    commerceTitle: isFrench ? 'Votre marché reste à portée de main.' : 'Your market stays within reach.',
    commerceDescription: isFrench
      ? 'Retrouvez vos boutiques suivies, vos discussions vendeurs et vos livraisons dans un espace clair.'
      : 'Access followed shops, seller conversations, and deliveries in one clear workspace.',
    liveStatus: isFrench ? 'Espace client prêt' : 'Customer space ready',
    deliveryStatus: isFrench ? 'Livraisons suivies' : 'Tracked deliveries',
    messageStatus: isFrench ? 'Messages vendeurs' : 'Seller messages'
  };

  const handleGoogleSignIn = async () => {
    if (!authAvailability.google.login || loading || providerLoading) return;
    setError('');
    setProviderLoading('google');
    try {
      const idToken = await signInWithGoogle();
      const { data } = await api.post('/auth/provider/google', { idToken });
      if (data?.profileRequired) {
        if (!authAvailability.google.registration) {
          setError(isFrench ? 'La création de compte avec Google est désactivée.' : 'Account creation with Google is disabled.');
          return;
        }
        nav('/register', {
          state: { from, providerAuth: { provider: 'google', idToken, profile: data.profile } }
        });
        return;
      }
      await login(data);
      nav(from, { replace: true });
    } catch (requestError) {
      if (requestError?.code === 'auth/popup-closed-by-user') return;
      setError(requestError?.response ? mapLoginErrorMessage(requestError, isFrench) : (
        isFrench ? 'La connexion avec Google a échoué. Veuillez réessayer.' : 'Google sign-in failed. Please try again.'
      ));
    } finally {
      setProviderLoading('');
    }
  };

  const handleAppleSignIn = async () => {
    if (!authAvailability.apple.login || loading || providerLoading) return;
    setError('');
    setProviderLoading('apple');
    try {
      const appleCredential = await signInWithApple();
      const { data } = await api.post('/auth/provider/apple', { idToken: appleCredential.idToken });
      if (data?.profileRequired) {
        if (!authAvailability.apple.registration) {
          setError(isFrench ? 'La création de compte avec Apple est désactivée.' : 'Account creation with Apple is disabled.');
          return;
        }
        nav('/register', {
          state: {
            from,
            providerAuth: {
              provider: 'apple',
              idToken: appleCredential.idToken,
              profile: {
                ...data.profile,
                name: appleCredential.profile?.name || data.profile?.name || '',
                email: appleCredential.profile?.email || data.profile?.email || ''
              }
            }
          }
        });
        return;
      }
      await login(data);
      nav(from, { replace: true });
    } catch (requestError) {
      if (requestError?.code === 'auth/popup-closed-by-user') return;
      setError(requestError?.response ? mapLoginErrorMessage(requestError, isFrench) : (
        isFrench ? 'La connexion avec Apple a échoué. Veuillez réessayer.' : 'Apple sign-in failed. Please try again.'
      ));
    } finally {
      setProviderLoading('');
    }
  };

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!authAvailability.email.login || loading) return;

    setError('');
    if (!form.phone.trim()) {
      setError(isFrench ? 'Saisissez votre email ou votre numéro de téléphone.' : 'Enter your email or phone number.');
      identifierRef.current?.focus();
      return;
    }
    if (!form.password.trim()) {
      setError(isFrench ? 'Saisissez votre mot de passe.' : 'Enter your password.');
      passwordRef.current?.focus();
      return;
    }
    setSlowNetwork(false);
    setLoading(true);
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork(true), SLOW_NETWORK_MS);

    try {
      const identifier = form.phone.trim();
      const credentials = identifier.includes('@')
        ? { email: identifier.toLowerCase(), password: form.password }
        : { phone: identifier, password: form.password, countryId: selectedCountry?.id || selectedCountry?._id };
      const { data } = await api.post('/auth/login', credentials);
      // Redirect directly — no success interstitial
      await login(data, { rememberMe });
      nav(from, { replace: true });
    } catch (requestError) {
      setInactiveAccount(
        String(requestError?.response?.data?.code || '').toUpperCase() === 'ACCOUNT_INACTIVE'
      );
      setError(mapLoginErrorMessage(requestError, isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setLoading(false);
    }
  };

  const requestReactivation = async () => {
    if (!form.phone.trim() || !form.password) {
      setReactivationFeedback(
        isFrench
          ? 'Saisissez votre identifiant et votre mot de passe.'
          : 'Enter your identifier and password.'
      );
      return;
    }
    setReactivationLoading(true);
    setReactivationFeedback('');
    try {
      const { data } = await api.post('/auth/reactivation-request', {
        identifier: form.phone.trim(),
        password: form.password,
        message: reactivationMessage.trim()
      });
      setReactivationFeedback(
        data?.message ||
          (isFrench
            ? 'Demande envoyée à l’administration.'
            : 'Request sent to the administration.')
      );
    } catch (requestError) {
      setReactivationFeedback(
        requestError?.response?.data?.message ||
          (isFrench ? 'Impossible d’envoyer la demande.' : 'Unable to send the request.')
      );
    } finally {
      setReactivationLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f3ee] text-[#141210] dark:bg-neutral-950 dark:text-white lg:px-8 lg:py-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1120px] flex-col justify-center lg:min-h-[calc(100dvh-3rem)]"
      >
        <div className="grid min-h-[100dvh] w-full overflow-hidden bg-[#f6f3ee] lg:min-h-[700px] lg:grid-cols-2 lg:rounded-[22px] lg:ring-1 lg:ring-[#e7dfd5] dark:bg-neutral-950 dark:ring-neutral-800">
          <motion.section
            variants={fadeUp}
            className="hd-auth-form relative flex min-h-[100dvh] flex-col px-6 pb-6 pt-7 lg:min-h-[700px] lg:px-16 lg:py-14"
          >
            <Link to="/" className="inline-flex w-fit items-center gap-2.5 text-[15px] font-extrabold text-[#141210] dark:text-white">
              <img src={logoSrc} alt={copy.appBadge} className="h-8 w-8 rounded-[9px] object-contain lg:h-[30px] lg:w-[30px] lg:rounded-lg" />
              {copy.appBadge}
            </Link>
            <AnimatePresence mode="wait">
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="mt-9 flex flex-1 flex-col lg:my-auto lg:max-w-[400px] lg:flex-none"
                >
                  <header className="mb-7">
                    <h1 className="text-[30px] font-black leading-[1.15] tracking-[-0.03em] text-[#141210] dark:text-white lg:text-[34px]">
                      {copy.title}
                    </h1>
                    <p className="mt-2 max-w-sm text-[15px] font-medium leading-[1.55] text-[#78716c] dark:text-neutral-400 lg:mt-2.5 lg:text-[15.5px]">
                      {copy.subtitle}
                    </p>
                  </header>

                  {authAvailability.email.login ? <form onSubmit={submit} className="space-y-4">
                    {error ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[14px] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#b91c1c] ring-1 ring-[#fecaca] dark:bg-red-500/10 dark:text-red-100 dark:ring-red-400/20"
                        role="alert"
                      >
                        {error}
                      </motion.div>
                    ) : null}
                    {inactiveAccount ? (
                      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-500/10">
                        <div>
                          <p className="text-sm font-black text-amber-950 dark:text-amber-100">
                            {isFrench
                              ? 'Demander la réactivation'
                              : 'Request account reactivation'}
                          </p>
                          <p className="mt-1 text-xs font-medium leading-5 text-amber-800 dark:text-amber-200">
                            {isFrench
                              ? 'Votre demande sera examinée par un administrateur. Votre mot de passe confirme que vous êtes le propriétaire du compte.'
                              : 'An administrator will review your request. Your password confirms account ownership.'}
                          </p>
                        </div>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={reactivationMessage}
                          onChange={(event) =>
                            setReactivationMessage(event.target.value.slice(0, 500))
                          }
                          placeholder={
                            isFrench
                              ? 'Message facultatif pour l’administrateur'
                              : 'Optional message for the administrator'
                          }
                          className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:bg-neutral-900"
                        />
                        <button
                          type="button"
                          onClick={requestReactivation}
                          disabled={reactivationLoading}
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-black text-white disabled:opacity-50"
                        >
                          {reactivationLoading
                            ? isFrench
                              ? 'Envoi…'
                              : 'Sending…'
                            : isFrench
                              ? 'Envoyer la demande'
                              : 'Send request'}
                        </button>
                        {reactivationFeedback ? (
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
                            {reactivationFeedback}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-[7px]">
                      <label htmlFor="login-identifier" className="text-[13.5px] font-semibold text-[#57534e] dark:text-neutral-400">
                        {copy.identifierLabel}
                      </label>
                      <div className="flex h-14 items-center overflow-hidden rounded-[14px] bg-white px-4 shadow-[inset_0_0_0_1px_#e7dfd5] transition focus-within:shadow-[inset_0_0_0_2px_#e85d00] dark:bg-neutral-900 dark:shadow-[inset_0_0_0_1px_#262626]">
                        <input
                          id="login-identifier"
                          ref={identifierRef}
                          type="text"
                          autoComplete="username"
                          inputMode="email"
                          className="hd-auth-autofill !h-full !min-h-0 w-full flex-1 !rounded-none !border-0 !bg-transparent !p-0 !text-base !font-medium !text-[#141210] !shadow-none outline-none placeholder:!text-[#a8a29e] focus:!bg-transparent focus:!shadow-none dark:!bg-transparent dark:!text-white dark:placeholder:!text-neutral-500"
                          placeholder={copy.identifierPlaceholder}
                          value={form.phone}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, phone: e.target.value }));
                            setError('');
                            setInactiveAccount(false);
                            setReactivationFeedback('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              passwordRef.current?.focus();
                            }
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-[7px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor="login-password" className="text-[13.5px] font-semibold text-[#57534e] dark:text-neutral-400">
                          {copy.passwordLabel}
                        </label>
                        <Link to="/forgot-password" className="text-[13.5px] font-bold text-[#b3480a] transition hover:text-[#f45f00] dark:text-orange-200">
                          {copy.forgotPassword}
                        </Link>
                      </div>
                      <div className="flex h-14 items-center overflow-hidden rounded-[14px] bg-white pl-4 pr-1 shadow-[inset_0_0_0_1px_#e7dfd5] transition focus-within:shadow-[inset_0_0_0_2px_#e85d00] dark:bg-neutral-900 dark:shadow-[inset_0_0_0_1px_#262626]">
                        <input
                          id="login-password"
                          ref={passwordRef}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          className="hd-auth-autofill !h-full !min-h-0 flex-1 !rounded-none !border-0 !bg-transparent !p-0 !pr-2 !text-base !font-medium !text-[#141210] !shadow-none outline-none placeholder:!text-[#a8a29e] focus:!bg-transparent focus:!shadow-none dark:!bg-transparent dark:!text-white dark:placeholder:!text-neutral-500"
                          placeholder={copy.passwordPlaceholder}
                          value={form.password}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, password: e.target.value }));
                            setError('');
                            setInactiveAccount(false);
                            setReactivationFeedback('');
                          }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="flex h-11 w-11 items-center justify-center text-[#78716c] transition hover:text-[#141210] active:scale-95 dark:text-neutral-300 dark:hover:text-white"
                          aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-0.5">
                      <label className="inline-flex min-h-11 items-center gap-2.5 text-sm font-medium text-[#57534e] dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-transparent ring-1 ring-inset ring-[#d8d0c4] transition peer-checked:bg-[#e85d00] peer-checked:text-white peer-checked:ring-[#e85d00] dark:bg-neutral-900 dark:ring-neutral-700">
                          <Check size={14} strokeWidth={3} />
                        </span>
                        {copy.rememberMe}
                      </label>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileTap={{ scale: 0.985 }}
                      className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-[17px] font-extrabold text-white transition hover:bg-[#f45f00] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                      {loading ? copy.submitting : copy.submit}
                    </motion.button>

                    {slowNetwork && loading ? (
                      <p className="rounded-[14px] bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/20">
                        {copy.slowNetwork}
                      </p>
                    ) : null}
                  </form> : null}

                  {hasProviderLogin && authAvailability.email.login ? <div className="my-6 flex items-center gap-3.5 text-[13px] font-medium text-[#a8a29e]">
                    <span className="h-px flex-1 bg-[#e7dfd5] dark:bg-neutral-800" />
                    {copy.divider}
                    <span className="h-px flex-1 bg-[#e7dfd5] dark:bg-neutral-800" />
                  </div> : null}
                  {hasProviderLogin ? <div className="grid gap-2.5 lg:grid-cols-2">
                    {authAvailability.google.login ? <GoogleAuthButton
                      label={copy.google}
                      loading={providerLoading === 'google'}
                      disabled={loading || Boolean(providerLoading)}
                      onClick={handleGoogleSignIn}
                    /> : null}
                    {authAvailability.apple.login ? <AppleAuthButton
                      label={copy.apple}
                      loading={providerLoading === 'apple'}
                      disabled={loading || Boolean(providerLoading)}
                      onClick={handleAppleSignIn}
                    /> : null}
                  </div> : null}

                  {!hasLogin ? (
                    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                      {isFrench ? 'Les connexions sont temporairement désactivées. Contactez le support.' : 'Sign-in is temporarily disabled. Contact support.'}
                    </div>
                  ) : null}

                  <footer className="mt-auto grid gap-2.5 pt-8 text-center text-[#57534e] dark:text-neutral-300 lg:absolute lg:bottom-14 lg:left-16 lg:text-left">
                    {hasRegistration ? <p className="text-[14.5px] font-medium">
                      {copy.noAccount}{' '}
                      <Link to="/register" className="font-extrabold text-[#b3480a] transition hover:text-[#f45f00] dark:text-orange-100">
                        {copy.createAccount}
                      </Link>
                    </p> : null}
                    <p className="text-[12.5px] font-medium text-[#a8a29e] lg:hidden">
                      {copy.supportLead}{' '}
                      <Link to="/help" className="font-bold text-[#57534e] transition hover:text-[#e85d00] dark:text-white dark:hover:text-orange-100">
                        {copy.support}
                      </Link>
                    </p>
                  </footer>
                </motion.div>
            </AnimatePresence>
          </motion.section>

          <motion.div variants={fadeUp} className="hidden lg:block">
            <CommerceAuthPanel mode="login" logoSrc={logoSrc} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
