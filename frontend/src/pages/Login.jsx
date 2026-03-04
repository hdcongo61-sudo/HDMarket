import React, { useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import AuthTrustPanel from '../components/auth/AuthTrustPanel';
import AuthSuccessCard from '../components/auth/AuthSuccessCard';

const SLOW_NETWORK_MS = 8000;

const mapLoginErrorMessage = (error) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (code.includes('TIMEDOUT') || rawMessage.includes('timeout')) {
    return 'Connexion lente. Veuillez réessayer.';
  }
  if (status === 401 || status === 403) {
    return 'Mot de passe incorrect. Veuillez réessayer.';
  }
  if (status === 404 || rawMessage.includes('not found') || rawMessage.includes('introuvable')) {
    return 'Aucun compte trouvé avec cet email ou ce téléphone.';
  }
  if (status >= 500) {
    return 'Service temporairement indisponible. Veuillez réessayer.';
  }
  return 'Impossible de vous connecter pour le moment. Veuillez réessayer.';
};

export default function Login() {
  const { user, login } = useContext(AuthContext);
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
      setError(mapLoginErrorMessage(requestError));
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
                    HDMarket
                  </p>
                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    Welcome back
                  </h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Sign in to access your orders, messages, and deliveries.
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
                      Email ou téléphone
                    </label>
                    <input
                      id="login-identifier"
                      ref={identifierRef}
                      type="text"
                      autoComplete="username"
                      inputMode="email"
                      className="ui-input min-h-[48px] rounded-xl px-3 text-sm"
                      placeholder="nom@email.com ou 060000000"
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
                      Mot de passe
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="ui-input min-h-[48px] w-full rounded-xl px-3 pr-12 text-sm"
                        placeholder="Votre mot de passe"
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
                        aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
                      Remember me
                    </label>
                    <Link to="/forgot-password" className="text-xs font-semibold text-slate-700 hover:underline dark:text-slate-100">
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !form.phone.trim() || !form.password.trim()}
                    className="soft-card soft-card-purple inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-purple-900 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:text-purple-100"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>

                  {slowNetwork && loading ? (
                    <p className="text-xs text-amber-700 dark:text-amber-200">
                      Network is slow, please retry.
                    </p>
                  ) : null}
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-300">
                  <span className="h-px flex-1 bg-white/45 dark:bg-slate-700" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-white/45 dark:bg-slate-700" />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled
                    className="glass-card inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 opacity-80"
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    disabled
                    className="glass-card inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-500 opacity-80"
                  >
                    Continue with Apple
                  </button>
                </div>

                <footer className="mt-6 border-t border-white/35 pt-4 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    Don&apos;t have an account?{' '}
                    <Link to="/register" className="font-semibold text-slate-800 hover:underline dark:text-white">
                      Create account
                    </Link>
                  </p>
                  <p className="mt-2">
                    Need help?{' '}
                    <Link to="/help" className="font-semibold text-slate-800 hover:underline dark:text-white">
                      Contact support
                    </Link>
                  </p>
                </footer>
              </>
            ) : (
              <AuthSuccessCard
                variant="login"
                loading={finalizing || loading}
                title="Login successful"
                description="Welcome back. Preparing your dashboard."
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
