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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data);
      nav(from, { replace: true });
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[400px]">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-normal text-indigo-600 mb-1">HDMarket</h1>
          <p className="text-sm text-gray-500">Connectez-vous à votre compte</p>
        </div>

        {/* Login Form */}
        <div className="bg-white border border-gray-200 p-6">
          <form onSubmit={submit} className="space-y-4">
            {/* Phone Input */}
            <div>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm"
                placeholder="Numéro de téléphone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-3 py-2.5 border border-gray-300 focus:outline-none focus:border-indigo-600 text-sm pr-10"
                placeholder="Mot de passe"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-1"
                />
                <span>Se souvenir de moi</span>
              </label>
              <Link 
                to="/forgot-password" 
                className="text-gray-600 hover:text-indigo-600"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !form.phone || !form.password}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-3xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              to="/register"
              className="block w-full py-3 text-center border border-gray-300 bg-white text-gray-700 text-sm font-semibold rounded-3xl hover:bg-gray-50 transition-all duration-200 active:scale-95 shadow-sm"
            >
              Créer un compte
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            En vous connectant, vous acceptez nos{' '}
            <Link to="/help" className="text-gray-600 hover:text-indigo-600">
              conditions d'utilisation
            </Link>{' '}
            et notre{' '}
            <Link to="/privacy" className="text-gray-600 hover:text-indigo-600">
              politique de confidentialité
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
