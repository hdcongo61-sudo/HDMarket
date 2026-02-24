import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, RefreshCcw, UserCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import LanguageSwitcher from '../components/settings/LanguageSwitcher';
import CurrencySelector from '../components/settings/CurrencySelector';
import CitySelector from '../components/settings/CitySelector';
import { useToast } from '../context/ToastContext';
import { unregisterServiceWorker } from '../utils/serviceWorker';
import { clearAllCache } from '../services/api';
import indexedDB, { STORES } from '../utils/indexedDB';
import { clearSearchCache } from '../utils/searchCache';

export default function UserSettings() {
  const { user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { theme, setTheme, formatPrice, savingPreferences, t, refreshSettings } = useAppSettings();
  const [clearingPwaCache, setClearingPwaCache] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
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

  const handleClearPwaCache = useCallback(async () => {
    if (clearingPwaCache) return;
    const shouldContinue =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            t(
              'settings.cache.confirm',
              'Cette action vide tout le cache utilisateur (PWA + donnees locales) puis recharge l’application. Continuer ?'
            )
          );
    if (!shouldContinue) return;

    setClearingPwaCache(true);
    try {
      queryClient.clear();
      await clearAllCache();
      await clearSearchCache();
      await Promise.all([
        indexedDB.clear(STORES.CACHE),
        indexedDB.clear(STORES.PRODUCTS),
        indexedDB.clear(STORES.SEARCH_RESULTS),
        indexedDB.clear(STORES.SHOP_DATA)
      ]);

      if (typeof window !== 'undefined') {
        const removableKeys = [
          'cached_orders',
          'hdmarket:cache-keys',
          'hdmarket:recent-product-views',
          'hdmarket_saved_searches',
          'hdmarket_custom_nav_items',
          'hdmarket_chat_hidden',
          'hdmarket_chat_button_collapsed'
        ];
        const removablePrefixes = [
          'hdmarket:api-cache:',
          'hdmarket:shop-snapshot:',
          'hdmarket:search-cache:',
          'hdmarket_chat_key_'
        ];
        removableKeys.forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // ignore storage errors
          }
        });
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (removablePrefixes.some((prefix) => key.startsWith(prefix))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((key) => localStorage.removeItem(key));
        } catch {
          // ignore storage errors
        }
        try {
          sessionStorage.clear();
        } catch {
          // ignore storage errors
        }
      }

      await unregisterServiceWorker();
      showToast(t('settings.cache.cleared', 'Cache utilisateur vide. Rechargement...'), { variant: 'success' });
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set('refresh', String(Date.now()));
          window.location.replace(url.toString());
        }, 650);
      }
    } catch (error) {
      showToast(
        t('settings.cache.error', 'Impossible de vider le cache PWA pour le moment.'),
        { variant: 'error' }
      );
    } finally {
      setClearingPwaCache(false);
    }
  }, [clearingPwaCache, queryClient, showToast, t]);

  const handleHardRefresh = useCallback(() => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    if (typeof window === 'undefined') {
      setHardRefreshing(false);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', String(Date.now()));
    window.location.replace(url.toString());
  }, [hardRefreshing]);

  return (
    <div className="ui-page min-h-screen">
      <header className="ui-glass-header sticky top-20 z-20">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/profile"
            className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center"
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

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20 pt-6">
        <section className="ui-card px-4 py-5">
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

        <section className="ui-card space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.language', 'Langue')}</h2>
          <LanguageSwitcher />
        </section>

        <section className="ui-card space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.currency', 'Devise')}</h2>
          <CurrencySelector />
          <p className="text-xs text-gray-500 dark:text-neutral-400">{t('settings.pricePreview', 'Apercu prix')}: {previewPrice}</p>
        </section>

        <section className="ui-card space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.city', 'Ville')}</h2>
          <CitySelector />
        </section>

        <section className="ui-card space-y-4 px-4 py-5">
          <div className="flex items-center gap-2">
            <Palette size={16} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">{t('settings.appearance', 'Apparence')}</h2>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="ui-input w-full px-3 py-2 text-sm"
          >
            {themeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </section>

        <section className="ui-card space-y-4 px-4 py-5">
          <div className="flex items-center gap-2">
            <RefreshCcw size={16} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">{t('settings.cache.title', 'Maintenance cache')}</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {t(
              'settings.cache.description',
              'Supprime les caches locaux (PWA, IndexedDB, donnees temporaires) ou force un rechargement immediat.'
            )}
          </p>
          <button
            type="button"
            onClick={handleClearPwaCache}
            disabled={clearingPwaCache}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearingPwaCache
              ? t('settings.cache.clearing', 'Nettoyage en cours...')
              : t('settings.cache.action', 'Vider tout le cache utilisateur')}
          </button>
          <button
            type="button"
            onClick={handleHardRefresh}
            disabled={hardRefreshing || clearingPwaCache}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {hardRefreshing
              ? t('settings.cache.refreshing', 'Actualisation...')
              : t('settings.cache.hardRefresh', 'Hard refresh (forcer)')}
          </button>
        </section>
      </div>
    </div>
  );
}
