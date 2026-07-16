import React, { useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  LockKeyhole,
  User,
  ShieldCheck
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppSettings } from '../context/AppSettingsContext';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import CommerceAuthPanel from '../components/auth/CommerceAuthPanel';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import AppleAuthButton from '../components/auth/AppleAuthButton';
import { signInWithApple, signInWithGoogle } from '../services/providerAuth';

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
  const { language } = useAppSettings();
  const { isMobile, logoSrc } = useAppBrandLogo();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const slowNetworkTimerRef = useRef(null);

  const [form, setForm] = useState({ phone: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState('');
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [error, setError] = useState('');
  const isFrench = String(language || 'fr')
    .toLowerCase()
    .startsWith('fr');

  const copy = {
    appBadge: 'HDMarket',
    title: isFrench ? 'Bon retour' : 'Welcome back',
    subtitle: isFrench
      ? 'Connectez-vous pour accéder à vos commandes, messages et livraisons.'
      : 'Sign in to access your orders, messages, and deliveries.',
    identifierLabel: isFrench ? 'Email ou téléphone' : 'Email or phone',
    identifierPlaceholder: isFrench ? 'nom@email.com ou 060000000' : 'name@email.com or 060000000',
    passwordLabel: isFrench ? 'Mot de passe' : 'Password',
    passwordPlaceholder: isFrench ? 'Votre mot de passe' : 'Your password',
    showPassword: isFrench ? 'Afficher le mot de passe' : 'Show password',
    hidePassword: isFrench ? 'Masquer le mot de passe' : 'Hide password',
    rememberMe: isFrench ? 'Se souvenir de moi' : 'Remember me',
    forgotPassword: isFrench ? 'Mot de passe oublié ?' : 'Forgot password?',
    submit: isFrench ? 'Se connecter' : 'Sign in',
    submitting: isFrench ? 'Connexion...' : 'Signing in...',
    divider: isFrench ? 'ou' : 'or',
    google: isFrench ? 'Continuer avec Google' : 'Continue with Google',
    apple: isFrench ? 'Continuer avec Apple' : 'Continue with Apple',
    noAccount: isFrench ? "Vous n'avez pas de compte ?" : "Don't have an account?",
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
    if (loading || providerLoading) return;
    setError('');
    setProviderLoading('google');
    try {
      const idToken = await signInWithGoogle();
      const { data } = await api.post('/auth/provider/google', { idToken });
      if (data?.profileRequired) {
        nav('/register', {
          state: { from, providerAuth: { provider: 'google', idToken, profile: data.profile } }
        });
        return;
      }
      await login(data);
      nav(from, { replace: true });
    } catch (requestError) {
      if (requestError?.code === 'auth/popup-closed-by-user') return;
      setError(
        isFrench
          ? 'La connexion avec Google a échoué. Veuillez réessayer.'
          : 'Google sign-in failed. Please try again.'
      );
    } finally {
      setProviderLoading('');
    }
  };

  const handleAppleSignIn = async () => {
    if (loading || providerLoading) return;
    setError('');
    setProviderLoading('apple');
    try {
      const appleCredential = await signInWithApple();
      const { data } = await api.post('/auth/provider/apple', { idToken: appleCredential.idToken });
      if (data?.profileRequired) {
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
      setError(
        isFrench
          ? 'La connexion avec Apple a échoué. Veuillez réessayer.'
          : 'Apple sign-in failed. Please try again.'
      );
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
    if (loading) return;

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
        : { phone: identifier, password: form.password };
      const { data } = await api.post('/auth/login', credentials);
      // Redirect directly — no success interstitial
      await login(data);
      nav(from, { replace: true });
    } catch (requestError) {
      setError(mapLoginErrorMessage(requestError, isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f5f5] px-4 py-4 text-gray-900 dark:bg-neutral-950 dark:text-white sm:px-6 lg:px-8">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col justify-center gap-4"
      >
        <motion.nav
          variants={fadeUp}
          className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <Link to="/" className="inline-flex items-center gap-2 rounded-2xl pr-2 text-sm font-black text-gray-900 dark:text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-neutral-900">
              <img src={logoSrc} alt={copy.appBadge} className="h-7 w-7 object-contain" />
            </span>
            {copy.appBadge}
          </Link>
          <span className="inline-flex items-center gap-2 rounded bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#e85d00] dark:bg-orange-400/10 dark:text-orange-100">
            <ShieldCheck size={14} />
            {copy.sessionLabel}
          </span>
        </motion.nav>

        <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch">
          <motion.section
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-7"
          >
            <AnimatePresence mode="wait">
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <header className="mb-7">
                    <h1 className="text-[28px] font-black leading-[1.15] tracking-normal text-[#231f1b] dark:text-white">
                      {copy.title}
                    </h1>
                    <p className="mt-3 max-w-sm text-[15px] leading-6 text-gray-600 dark:text-neutral-300">
                      {copy.subtitle}
                    </p>
                  </header>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <GoogleAuthButton
                      label={copy.google}
                      loading={providerLoading === 'google'}
                      disabled={loading || Boolean(providerLoading)}
                      onClick={handleGoogleSignIn}
                    />
                    <AppleAuthButton
                      label={copy.apple}
                      loading={providerLoading === 'apple'}
                      disabled={loading || Boolean(providerLoading)}
                      onClick={handleAppleSignIn}
                    />
                  </div>
                  <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <span className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                    {copy.divider}
                    <span className="h-px flex-1 bg-gray-200 dark:bg-neutral-800" />
                  </div>

                  <form onSubmit={submit} className="space-y-4">
                    {error ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100"
                        role="alert"
                      >
                        {error}
                      </motion.div>
                    ) : null}

                    <div className="space-y-2">
                      <label htmlFor="login-identifier" className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                        {copy.identifierLabel}
                      </label>
                      <div className="flex min-h-[52px] items-center overflow-hidden rounded-xl border border-[#e2dcd2] bg-white px-3 transition focus-within:border-[#e85d00] focus-within:ring-2 focus-within:ring-[#e85d00]/10 dark:border-neutral-800 dark:bg-neutral-900">
                        <span className="flex items-center justify-center text-[#a49c8f]">
                          <User size={18} />
                        </span>
                        <input
                          id="login-identifier"
                          ref={identifierRef}
                          type="text"
                          autoComplete="username"
                          inputMode="email"
                          className="ui-input min-h-[52px] flex-1 border-0 bg-transparent px-3 text-[15px] placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                          placeholder={copy.identifierPlaceholder}
                          value={form.phone}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, phone: e.target.value }));
                            setError('');
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

                    <div className="space-y-2">
                      <label htmlFor="login-password" className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                        {copy.passwordLabel}
                      </label>
                      <div className="flex min-h-[52px] items-center overflow-hidden rounded-xl border border-[#e2dcd2] bg-white px-3 transition focus-within:border-[#e85d00] focus-within:ring-2 focus-within:ring-[#e85d00]/10 dark:border-neutral-800 dark:bg-neutral-900">
                        <span className="flex items-center justify-center text-[#a49c8f]">
                          <LockKeyhole size={18} />
                        </span>
                        <input
                          id="login-password"
                          ref={passwordRef}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          className="ui-input min-h-[52px] flex-1 border-0 bg-transparent px-3 pr-2 text-[15px] placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                          placeholder={copy.passwordPlaceholder}
                          value={form.password}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, password: e.target.value }));
                            setError('');
                          }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="flex h-11 w-11 items-center justify-center text-gray-500 transition hover:text-gray-900 active:scale-95 dark:text-neutral-300 dark:hover:text-white"
                          aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 accent-[#e85d00] dark:border-neutral-700"
                        />
                        {copy.rememberMe}
                      </label>
                      <Link to="/forgot-password" className="text-sm font-black text-[#e85d00] transition hover:text-[#e85f00] dark:text-orange-200 dark:hover:text-orange-100">
                        {copy.forgotPassword}
                      </Link>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileTap={{ scale: 0.985 }}
                      className="group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#e85d00] px-4 text-[15px] font-black text-white transition hover:bg-[#bf4d00] disabled:cursor-wait disabled:opacity-70"
                    >
                      {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                      {loading ? copy.submitting : copy.submit}
                      {!loading ? <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /> : null}
                    </motion.button>

                    {slowNetwork && loading ? (
                      <p className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-100">
                        {copy.slowNetwork}
                      </p>
                    ) : null}
                  </form>

                  <footer className="mt-6 grid gap-2 border-t border-gray-100 pt-5 text-sm text-gray-600 dark:border-neutral-800 dark:text-neutral-300">
                    <p>
                      {copy.noAccount}{' '}
                      <Link to="/register" className="font-black text-[#e85d00] transition hover:text-[#e85f00] dark:text-orange-100">
                        {copy.createAccount}
                      </Link>
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <HelpCircle size={15} />
                      {copy.supportLead}{' '}
                      <Link to="/help" className="font-black text-gray-900 transition hover:text-[#e85d00] dark:text-white dark:hover:text-orange-100">
                        {copy.support}
                      </Link>
                    </p>
                  </footer>
                </motion.div>
            </AnimatePresence>
          </motion.section>

          <motion.div variants={fadeUp}>
            <CommerceAuthPanel mode="login" logoSrc={logoSrc} />
          </motion.div>
        </div>
      </motion.div>
    </main>
  );
}
