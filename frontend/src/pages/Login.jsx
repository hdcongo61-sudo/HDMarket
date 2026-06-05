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
  MessageCircle,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppSettings } from '../context/AppSettingsContext';
import useAppBrandLogo from '../hooks/useAppBrandLogo';

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
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'La connexion prend plus de temps que prévu. Réessayez dans un instant.' : 'Sign-in is taking longer than expected. Please try again shortly.';
  }
  if (status === 401 || status === 403) {
    return isFrench
      ? 'Mot de passe incorrect. Veuillez réessayer.'
      : 'Incorrect password. Please try again.';
  }
  if (status === 404 || rawMessage.includes('not found') || rawMessage.includes('introuvable')) {
    return isFrench
      ? 'Aucun compte trouvé avec cet email ou ce téléphone.'
      : 'No account found with this email or phone.';
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

  const commerceHighlights = [
    {
      key: 'orders',
      label: copy.liveStatus,
      value: isFrench ? 'Commandes synchronisées' : 'Orders synced',
      icon: ShoppingBag
    },
    {
      key: 'messages',
      label: copy.messageStatus,
      value: isFrench ? 'Réponses rapides' : 'Fast replies',
      icon: MessageCircle
    },
    {
      key: 'delivery',
      label: copy.deliveryStatus,
      value: isFrench ? 'Statuts en direct' : 'Live statuses',
      icon: Truck
    }
  ];

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setSlowNetwork(false);
    setLoading(true);
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork(true), SLOW_NETWORK_MS);

    try {
      const { data } = await api.post('/auth/login', form);
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
    <main className="min-h-screen overflow-hidden bg-[#f6f4ef] px-4 py-4 text-slate-950 dark:bg-[#070707] dark:text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.14),transparent_58%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.18),transparent_62%)]" />
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col justify-center gap-4"
      >
        <motion.nav
          variants={fadeUp}
          className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-black/5 bg-white/72 px-3 py-2 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]"
        >
          <Link to="/" className="inline-flex items-center gap-2 rounded-full pr-2 text-sm font-semibold text-slate-950 dark:text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
              <img src={logoSrc} alt={copy.appBadge} className="h-7 w-7 object-contain" />
            </span>
            {copy.appBadge}
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-300/15">
            <ShieldCheck size={14} />
            {copy.sessionLabel}
          </span>
        </motion.nav>

        <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch">
          <motion.section
            variants={fadeUp}
            className="relative overflow-hidden rounded-[24px] border border-black/5 bg-white/82 p-5 shadow-[0_24px_70px_rgba(20,20,20,0.10)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/76 sm:p-7"
          >
            <AnimatePresence mode="wait">
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  <header className="mb-7">
                    <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#111111] shadow-[0_18px_44px_rgba(0,0,0,0.18)] dark:bg-white">
                      <img
                        src={logoSrc}
                        alt={copy.appBadge}
                        className={`${isMobile ? 'h-10 w-10' : 'h-11 w-11'} object-contain`}
                      />
                    </div>
                    <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-slate-950 dark:text-white sm:text-[2.55rem]">
                      {copy.title}
                    </h1>
                    <p className="mt-3 max-w-sm text-[15px] leading-6 text-slate-600 dark:text-neutral-300">
                      {copy.subtitle}
                    </p>
                  </header>

                  <form onSubmit={submit} className="space-y-4">
                    {error ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100"
                        role="alert"
                      >
                        {error}
                      </motion.div>
                    ) : null}

                    <div className="space-y-2">
                      <label htmlFor="login-identifier" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">
                        {copy.identifierLabel}
                      </label>
                      <div className="flex items-stretch overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-[#FF6A00] focus-within:ring-2 focus-within:ring-[#FF6A00]/10 dark:border-white/10 dark:bg-white/[0.04]">
                        <span className="flex items-center justify-center border-r border-slate-200 bg-slate-50 px-4 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-500">
                          <Phone size={18} />
                        </span>
                        <input
                          id="login-identifier"
                          ref={identifierRef}
                          type="text"
                          autoComplete="username"
                          inputMode="email"
                          className="ui-input min-h-[54px] flex-1 border-0 bg-transparent px-4 text-[15px] placeholder:text-slate-400 dark:placeholder:text-neutral-500"
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
                      <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">
                        {copy.passwordLabel}
                      </label>
                      <div className="flex items-stretch overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-[#FF6A00] focus-within:ring-2 focus-within:ring-[#FF6A00]/10 dark:border-white/10 dark:bg-white/[0.04]">
                        <span className="flex items-center justify-center border-r border-slate-200 bg-slate-50 px-4 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-500">
                          <LockKeyhole size={18} />
                        </span>
                        <input
                          id="login-password"
                          ref={passwordRef}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          className="ui-input min-h-[54px] flex-1 border-0 bg-transparent px-4 pr-2 text-[15px] placeholder:text-slate-400 dark:placeholder:text-neutral-500"
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
                          className="flex items-center justify-center border-l border-slate-200 bg-slate-50 px-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
                          aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-orange-200 accent-[#ff6a00] dark:border-neutral-700"
                        />
                        {copy.rememberMe}
                      </label>
                      <Link to="/forgot-password" className="text-sm font-semibold text-[#d45a00] transition hover:text-[#9a4a00] dark:text-orange-200 dark:hover:text-orange-100">
                        {copy.forgotPassword}
                      </Link>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading || !form.phone.trim() || !form.password.trim()}
                      whileTap={{ scale: 0.985 }}
                      className="hd-primary-button group inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] px-4 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                      {loading ? copy.submitting : copy.submit}
                      {!loading ? <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /> : null}
                    </motion.button>

                    {slowNetwork && loading ? (
                      <p className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-100">
                        {copy.slowNetwork}
                      </p>
                    ) : null}
                  </form>

                  <footer className="mt-6 grid gap-2 border-t border-slate-200/70 pt-5 text-sm text-slate-600 dark:border-white/10 dark:text-neutral-300">
                    <p>
                      {copy.noAccount}{' '}
                      <Link to="/register" className="font-semibold text-slate-950 transition hover:text-emerald-700 dark:text-white dark:hover:text-emerald-200">
                        {copy.createAccount}
                      </Link>
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <HelpCircle size={15} />
                      {copy.supportLead}{' '}
                      <Link to="/help" className="font-semibold text-slate-950 transition hover:text-emerald-700 dark:text-white dark:hover:text-emerald-200">
                        {copy.support}
                      </Link>
                    </p>
                  </footer>
                </motion.div>
            </AnimatePresence>
          </motion.section>

          <motion.aside
            variants={fadeUp}
            className="relative hidden overflow-hidden rounded-[28px] border border-black/5 bg-[#111111] p-7 text-white shadow-[0_30px_80px_rgba(0,0,0,0.22)] dark:border-white/10 lg:block"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="relative flex h-full min-h-[590px] flex-col justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/82 ring-1 ring-white/10">
                  <ShieldCheck size={14} />
                  {copy.secureNote}
                </span>
                <h2 className="mt-8 max-w-md text-4xl font-semibold leading-[1.04] tracking-tight">
                  {copy.commerceTitle}
                </h2>
                <p className="mt-4 max-w-md text-[15px] leading-6 text-white/66">
                  {copy.commerceDescription}
                </p>
              </div>

              <div className="relative mt-10 rounded-[26px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">HDMarket</p>
                    <p className="mt-1 text-lg font-semibold text-white">{copy.liveStatus}</p>
                  </div>
                  <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(110,231,183,0.12)]" />
                </div>

                <div className="space-y-3">
                  {commerceHighlights.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.16 + index * 0.08, duration: 0.32 }}
                        className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.075] p-3"
                      >
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-slate-950">
                          <Icon size={19} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{item.label}</p>
                          <p className="mt-0.5 text-xs text-white/52">{item.value}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </motion.div>
    </main>
  );
}
