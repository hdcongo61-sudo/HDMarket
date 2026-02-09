import React, { useContext, useState } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useNavigate, Navigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { user, login } = useContext(AuthContext);
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({ phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data);
      nav(from, { replace: true });
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      setError(msg || 'Numéro de téléphone ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 safe-area-bottom bg-[#F2F2F7] dark:bg-black">
      <div className="w-full max-w-[400px]">
        {/* Header - Apple typography */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white mb-2">HDMarket</h1>
          <p className="text-[15px] text-[#8E8E93] dark:text-[#8E8E93]">Connectez-vous à votre compte</p>
        </div>

        {/* Login Form - Apple card */}
        <div className="apple-card p-6">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">
                {error}
              </div>
            )}
            <div>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="apple-input w-full"
                placeholder="Numéro de téléphone"
                value={form.phone}
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); setError(''); }}
                required
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="apple-input w-full pr-12"
                placeholder="Mot de passe"
                value={form.password}
                onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(''); }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8E8E93] hover:text-black rounded-full tap-feedback"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <label className="flex items-center text-[#8E8E93] cursor-pointer">
                <input type="checkbox" className="mr-2 rounded" />
                <span>Se souvenir de moi</span>
              </label>
              <Link to="/forgot-password" className="text-[#007AFF] hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !form.phone || !form.password}
              className="apple-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed disabled:!bg-[#C7C7CC]"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-[rgba(60,60,67,0.12)]">
            <Link
              to="/register"
              className="block w-full py-3 min-h-[48px] flex items-center justify-center rounded-full font-semibold text-[17px] text-[#007AFF] border border-[#C7C7CC] dark:border-[#38383A] bg-white dark:bg-[#1C1C1E] hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] tap-feedback transition-all"
            >
              Créer un compte
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[13px] text-[#8E8E93]">
            En vous connectant, vous acceptez nos{' '}
            <Link to="/help" className="text-[#007AFF] hover:underline">
              conditions d'utilisation
            </Link>{' '}
            et notre{' '}
            <Link to="/privacy" className="text-[#007AFF] hover:underline">
              politique de confidentialité
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
