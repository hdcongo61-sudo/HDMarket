import React, { useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import AuthTrustPanel from '../components/auth/AuthTrustPanel';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';

const SLOW_NETWORK_MS = 8000;

const mapLoginErrorMessage = (error, isFrench = true) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return isFrench ? 'Connexion lente. Veuillez réessayer.' : 'Network is slow. Please retry.';
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
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const slowNetworkTimerRef = useRef(null);
  const successRedirectTimerRef = useRef(null);

  const [form, setForm] = useState({ phone: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [error, setError] = useState('');
  const [successPayload, setSuccessPayload] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
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
    slowNetwork: isFrench ? 'Réseau lent, veuillez réessayer.' : 'Network is slow, please retry.',
    successTitle: isFrench ? 'Connexion réussie' : 'Login successful',
    successDescription: isFrench
      ? 'Bon retour. Préparation de votre espace.'
      : 'Welcome back. Preparing your dashboard.',
    successStatus: isFrench ? 'Préparation de votre espace...' : 'Preparing your workspace...'
  };

  useEffect(() => {
    return () => {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, []);

  const completeLogin = async (target = from) => {
    if (!successPayload || finalizing) return;
    setFinalizing(true);
    try {
      await login(successPayload);
      nav(target, { replace: true });
    } finally {
      setFinalizing(false);
    }
  };

  useEffect(() => {
    if (!successPayload) return;
    successRedirectTimerRef.current = setTimeout(() => {
      completeLogin(from);
    }, 1300);
    return () => {
      if (successRedirectTimerRef.current) clearTimeout(successRedirectTimerRef.current);
    };
  }, [successPayload]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault();
    if (loading || successPayload) return;

    setError('');
    setSlowNetwork(false);
    setLoading(true);
    if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
    slowNetworkTimerRef.current = setTimeout(() => setSlowNetwork(true), SLOW_NETWORK_MS);

    try {
      const { data } = await api.post('/auth/login', form);
      setSuccessPayload(data || null);
    } catch (requestError) {
      setError(mapLoginErrorMessage(requestError, isFrench));
    } finally {
      if (slowNetworkTimerRef.current) clearTimeout(slowNetworkTimerRef.current);
      setLoading(false);
    }
  };

  if (user && !successPayload && !finalizing) {
    return <Navigate to={from} replace />;
  }

  return (
    <main className="glass-page-shell min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-6">
          <section className="glass-card rounded-3xl p-5 shadow-sm sm:p-7">
            {!successPayload ? (
              <>
                <header className="mb-6">
                  <p className="inline-flex items-center gap-2 rounded-full soft-card soft-card-blue px-3 py-1 text-xs font-semibold text-blue-900 dark:text-blue-100">
                    <ShieldCheck size={14} />
                    {copy.appBadge}
                  </p>
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    {copy.title}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {copy.subtitle}
                  </p>
                </header>

                <form onSubmit={submit} className="space-y-4">
                  {error ? (
                    <div className="soft-card soft-card-red rounded-2xl px-3 py-2.5 text-sm text-red-700 dark:text-red-100" role="alert">
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label htmlFor="login-identifier" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {copy.identifierLabel}
                    </label>
                    <input
                      id="login-identifier"
                      ref={identifierRef}
                      type="text"
                      autoComplete="username"
                      inputMode="email"
                      className="ui-input min-h-[48px] rounded-xl px-3 text-sm"
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

                  <div className="space-y-1.5">
                    <label htmlFor="login-password" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {copy.passwordLabel}
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="ui-input min-h-[48px] w-full rounded-xl px-3 pr-12 text-sm"
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
                        className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg glass-card text-slate-600 dark:text-slate-200"
                        aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {copy.rememberMe}
                    </label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-slate-700 hover:underline dark:text-slate-100">
                      {copy.forgotPassword}
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !form.phone.trim() || !form.password.trim()}
                    className="soft-card soft-card-purple inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-purple-900 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:text-purple-100"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? copy.submitting : copy.submit}
                  </button>

                  {slowNetwork && loading ? (
                    <p className="text-xs text-amber-700 dark:text-amber-200">
                      {copy.slowNetwork}
                    </p>
                  ) : null}
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
                  <span className="h-px flex-1 bg-white/45 dark:bg-slate-700" />
                  <span>{copy.divider}</span>
                  <span className="h-px flex-1 bg-white/45 dark:bg-slate-700" />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled
                    className="glass-card inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 opacity-80"
                  >
                    {copy.google}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="glass-card inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 opacity-80"
                  >
                    {copy.apple}
                  </button>
                </div>

                <footer className="mt-6 border-t border-white/35 pt-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    {copy.noAccount}{' '}
                    <Link to="/register" className="font-semibold text-slate-800 hover:underline dark:text-white">
                      {copy.createAccount}
                    </Link>
                  </p>
                  <p className="mt-2">
                    {copy.supportLead}{' '}
                    <Link to="/help" className="font-semibold text-slate-800 hover:underline dark:text-white">
                      {copy.support}
                    </Link>
                  </p>
                </footer>
              </>
            ) : (
              <AuthSuccessCard
                variant="login"
                loading={finalizing || loading}
                title={copy.successTitle}
                description={copy.successDescription}
                statusText={copy.successStatus}
              />
            )}

            {!successPayload ? <AuthTrustPanel compact /> : null}
          </section>

          <AuthTrustPanel />
        </div>
      </div>
    </main>
  );
}
