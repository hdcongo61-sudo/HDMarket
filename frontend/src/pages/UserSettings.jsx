import React, { useContext, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, UserCircle } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import LanguageSwitcher from '../components/settings/LanguageSwitcher';
import CurrencySelector from '../components/settings/CurrencySelector';
import CitySelector from '../components/settings/CitySelector';

export default function UserSettings() {
  const { user } = useContext(AuthContext);
  const { theme, setTheme, formatPrice, savingPreferences, t, refreshSettings } = useAppSettings();
  const themeOptions = useMemo(
    () => [
      { value: 'system', label: t('settings.theme.system', 'Systeme') },
      { value: 'light', label: t('settings.theme.light', 'Clair') },
      { value: 'dark', label: t('settings.theme.dark', 'Sombre') }
    ],
    [t]
  );

  const previewPrice = useMemo(() => formatPrice(125000), [formatPrice]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="sticky top-20 z-20 border-b border-gray-100 bg-white/75 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/75">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/profile"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            aria-label={t('settings.back', 'Retour')}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-semibold">{t('settings.title', 'Parametres')}</h1>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {savingPreferences ? t('settings.syncing', 'Synchronisation en cours...') : t('settings.saved', 'Enregistre')}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 pb-20 pt-6">
        <section className="border-b border-gray-100 pb-6 dark:border-neutral-800">
          <div className="mb-3 flex items-center gap-2">
            <UserCircle size={18} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">{t('settings.profile', 'Profil')}</h2>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-300">
            <p>{user?.name || t('settings.user', 'Utilisateur')}</p>
            <p>{user?.phone || '-'}</p>
            <p>{user?.city || '-'}</p>
          </div>
        </section>

        <section className="space-y-4 border-b border-gray-100 py-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t('settings.language', 'Langue')}</h2>
          <LanguageSwitcher />
        </section>

        <section className="space-y-4 border-b border-gray-100 py-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t('settings.currency', 'Devise')}</h2>
          <CurrencySelector />
          <p className="text-xs text-gray-500 dark:text-neutral-400">{t('settings.pricePreview', 'Apercu prix')}: {previewPrice}</p>
        </section>

        <section className="space-y-4 border-b border-gray-100 py-6 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{t('settings.city', 'Ville')}</h2>
          <CitySelector />
        </section>

        <section className="space-y-4 py-6">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">{t('settings.appearance', 'Apparence')}</h2>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40"
          >
            {themeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </section>
      </div>
    </div>
  );
}
