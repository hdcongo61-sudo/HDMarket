import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import useAppBrandLogo from '../../hooks/useAppBrandLogo';

export const LightLogin = ({
  title = 'Bienvenue',
  subtitle = 'Connectez-vous pour continuer.',
  onSubmit,
  submitLabel = 'Se connecter',
  loading = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const { logoSrc, isMobile } = useAppBrandLogo();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSubmit === 'function') {
      onSubmit(event);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-48 bg-gradient-to-b from-blue-100 via-blue-50 to-transparent opacity-40 blur-3xl dark:from-blue-900/20 dark:via-blue-800/10" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt="Logo HDMarket"
                  className={`${isMobile ? 'h-12 w-12' : 'h-14 w-14'} object-contain`}
                />
              ) : (
                <ShieldCheck className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-300">
              {subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Email ou téléphone
              </label>
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Entrez votre email ou téléphone"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Mot de passe
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-blue-700 hover:via-blue-600 hover:to-blue-500 active:scale-[0.98] disabled:opacity-70"
            >
              {submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LightLogin;
