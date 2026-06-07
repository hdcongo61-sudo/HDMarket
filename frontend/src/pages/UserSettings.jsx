import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Bot, Palette, RefreshCcw, UserCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import LanguageSwitcher from '../components/settings/LanguageSwitcher';
import CurrencySelector from '../components/settings/CurrencySelector';
import CitySelector from '../components/settings/CitySelector';
import { useToast } from '../context/ToastContext';
import { unregisterServiceWorker } from '../utils/serviceWorker';
import { clearAllCache } from '../services/api';
import api from '../services/api';
import indexedDB, { STORES } from '../utils/indexedDB';
import { clearSearchCache } from '../utils/searchCache';
import { appConfirm } from '../utils/appDialog';

// ── Notification Toggle Component ──
const NotifToggle = React.memo(({ label, checked, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-700 dark:text-neutral-300">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-neutral-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
));

export default function UserSettings() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const {
    theme,
    setTheme,
    formatPrice,
    savingPreferences,
    t,
    refreshSettings,
    assistantChatEnabled,
    setAssistantChatEnabled
  } = useAppSettings();
  const [clearingPwaCache, setClearingPwaCache] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);
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

  // Load notification preferences
  useEffect(() => {
    let cancelled = false;
    api.get('/users/notification-preferences')
      .then(({ data }) => {
        if (!cancelled) setNotifPrefs(data?.preferences || {});
      })
      .catch(() => {
        if (!cancelled) setNotifPrefs({});
      });
    return () => { cancelled = true; };
  }, []);

  const handleNotifToggle = useCallback(async (key) => {
    if (!notifPrefs || savingNotifPrefs) return;
    const currentVal = notifPrefs[key];
    const newVal = !currentVal;
    // Optimistic update
    setNotifPrefs((prev) => ({ ...prev, [key]: newVal }));
    setSavingNotifPrefs(true);
    try {
      await api.patch('/users/notification-preferences', { [key]: newVal });
    } catch (err) {
      // Revert on failure
      console.error('[UserSettings] Failed to save notification preference:', key, err);
      setNotifPrefs((prev) => ({ ...prev, [key]: currentVal }));
      showToast(t('settings.notifError', 'Impossible d\'enregistrer la préférence.'), { variant: 'error' });
    } finally {
      setSavingNotifPrefs(false);
    }
  }, [notifPrefs, savingNotifPrefs, showToast, t]);

  const softRefreshCurrentRoute = useCallback(() => {
    const params = new URLSearchParams(location.search || '');
    params.set('refresh', String(Date.now()));
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const handleClearPwaCache = useCallback(async () => {
    if (clearingPwaCache) return;
    const shouldContinue =
      typeof window === 'undefined'
        ? true
        : await appConfirm(
            t(
              'settings.cache.confirm',
              'Cette action vide tout le cache utilisateur (PWA + donnees locales) puis recharge l’application. Continuer ?'
            )
          );
    if (!shouldContinue) return;

    setClearingPwaCache(true);
    try {
      queryClient.clear();
      const cleanupTasks = [
        clearAllCache(),
        clearSearchCache(),
        indexedDB.clear(STORES.CACHE),
        indexedDB.clear(STORES.PRODUCTS),
        indexedDB.clear(STORES.SEARCH_RESULTS),
        indexedDB.clear(STORES.SHOP_DATA)
      ];
      const cleanupResults = await Promise.allSettled(cleanupTasks);

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

      const swResult = await Promise.resolve(unregisterServiceWorker())
        .then(() => ({ ok: true }))
        .catch(() => ({ ok: false }));

      const hasAnyFailure = cleanupResults.some((entry) => entry.status === 'rejected') || !swResult.ok;
      if (hasAnyFailure) {
        showToast(
          t(
            'settings.cache.partial',
            'Cache utilisateur nettoye partiellement. Rechargement recommande.'
          ),
          { variant: 'warning' }
        );
      } else {
        showToast(t('settings.cache.cleared', 'Cache utilisateur vide. Rechargement...'), {
          variant: 'success'
        });
      }
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          softRefreshCurrentRoute();
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
  }, [clearingPwaCache, queryClient, showToast, softRefreshCurrentRoute, t]);

  const handleHardRefresh = useCallback(async () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    if (typeof window === 'undefined') {
      setHardRefreshing(false);
      return;
    }
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries(),
        Promise.resolve(refreshSettings())
      ]);
      softRefreshCurrentRoute();
      showToast(
        t('settings.cache.refreshed', 'Donnees actualisees sans rechargement complet.'),
        { variant: 'success' }
      );
    } finally {
      setHardRefreshing(false);
    }
  }, [hardRefreshing, queryClient, refreshSettings, showToast, softRefreshCurrentRoute, t]);

  return (
    <div className="hd-profile-flow hd-commerce-shell min-h-screen">
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
        <section className="ui-card rounded-[24px] px-4 py-5">
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

        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.language', 'Langue')}</h2>
          <LanguageSwitcher />
        </section>

        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.currency', 'Devise')}</h2>
          <CurrencySelector />
          <p className="text-xs text-gray-500 dark:text-neutral-400">{t('settings.pricePreview', 'Apercu prix')}: {previewPrice}</p>
        </section>

        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
          <h2 className="text-sm font-semibold">{t('settings.city', 'Ville')}</h2>
          <CitySelector />
        </section>

        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
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

        <section className="ui-card rounded-[24px] space-y-3 px-4 py-5">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">
              {t('settings.assistantChat', 'Assistant chat')}
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {t(
              'settings.assistantChatDescription',
              'Activez ou desactivez le bouton flottant de l’assistant HDMarket.'
            )}
          </p>
          <NotifToggle
            label={
              assistantChatEnabled
                ? t('settings.assistantChatEnabled', 'Assistant active')
                : t('settings.assistantChatDisabled', 'Assistant desactive')
            }
            checked={assistantChatEnabled}
            onChange={() => setAssistantChatEnabled(!assistantChatEnabled)}
          />
        </section>

        {/* ── Notification Preferences ── */}
        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-gray-500 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold">{t('settings.notifications', 'Notifications')}</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            {t('settings.notifDescription', 'Choisissez les notifications que vous souhaitez recevoir.')}
          </p>

          {!notifPrefs ? (
            <p className="py-3 text-center text-sm text-gray-400">{t('settings.loading', 'Chargement...')}</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-700">
              {/* ── COMMANDES ── */}
              <div className="py-2">
                <p className="mb-2 text-xs font-semibold text-orange-600">{t('settings.notifOrders', 'Commandes')}</p>
                {[
                  ['order_created', t('settings.notifOrderCreated', 'Commande confirmée')],
                  ['order_received', t('settings.notifOrderReceived', 'Nouvelle commande reçue')],
                  ['order_delivering', t('settings.notifOrderDelivering', 'Colis en route')],
                  ['order_delivered', t('settings.notifOrderDelivered', 'Commande livrée')],
                  ['order_cancelled', t('settings.notifOrderCancelled', 'Commande annulée')],
                  ['order_message', t('settings.notifOrderMessage', 'Nouveau message commande')],
                  ['order_reminder', t('settings.notifOrderReminder', 'Rappel de commande')],
                  ['review_reminder', t('settings.notifReviewReminder', 'Rappel d\'avis')],
                ].map(([key, label]) => (
                  <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => handleNotifToggle(key)} />
                ))}
              </div>

              {/* ── PAIEMENTS ── */}
              <div className="py-2">
                <p className="mb-2 text-xs font-semibold text-green-600">{t('settings.notifPayments', 'Paiements')}</p>
                {[
                  ['payment_pending', t('settings.notifPaymentPending', 'Paiement en attente')],
                  ['installment_due_reminder', t('settings.notifInstallmentDue', 'Échéance approche')],
                  ['installment_overdue_warning', t('settings.notifInstallmentOverdue', 'Tranche en retard')],
                ].map(([key, label]) => (
                  <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => handleNotifToggle(key)} />
                ))}
              </div>

              {/* ── SOCIAL ── */}
              <div className="py-2">
                <p className="mb-2 text-xs font-semibold text-blue-600">{t('settings.notifSocial', 'Social')}</p>
                {[
                  ['product_comment', t('settings.notifComment', 'Commentaires')],
                  ['reply', t('settings.notifReply', 'Réponses')],
                  ['favorite', t('settings.notifFavorite', 'Ajouts aux favoris')],
                  ['rating', t('settings.notifRating', 'Évaluations')],
                  ['shop_review', t('settings.notifShopReview', 'Avis boutique')],
                  ['shop_follow', t('settings.notifShopFollow', 'Nouveaux abonnés')],
                ].map(([key, label]) => (
                  <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => handleNotifToggle(key)} />
                ))}
              </div>

              {/* ── ENGAGEMENT (Proposal 8) ── */}
              <div className="py-2">
                <p className="mb-2 text-xs font-semibold text-purple-600">{t('settings.notifEngagement', 'Découvertes & Bons plans')}</p>
                {[
                  ['price_drop', t('settings.notifPriceDrop', '📉 Baisse de prix sur mes favoris')],
                  ['back_in_stock', t('settings.notifBackInStock', '🔄 Produit de retour en stock')],
                  ['abandoned_cart', t('settings.notifAbandonedCart', '🛒 Rappel panier oublié')],
                  ['seller_new_product', t('settings.notifSellerNewProduct', '🆕 Nouveautés des boutiques suivies')],
                  ['weekly_digest', t('settings.notifWeeklyDigest', '📊 Récap hebdomadaire')],
                ].map(([key, label]) => (
                  <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => handleNotifToggle(key)} />
                ))}
              </div>

              {/* ── COMPTE ── */}
              <div className="py-2">
                <p className="mb-2 text-xs font-semibold text-gray-600">{t('settings.notifAccount', 'Compte')}</p>
                {[
                  ['admin_broadcast', t('settings.notifAdminBroadcast', 'Messages HDMarket')],
                  ['account_restriction', t('settings.notifAccountRestriction', 'Restrictions de compte')],
                  ['dispute_created', t('settings.notifDisputeCreated', 'Litiges')],
                ].map(([key, label]) => (
                  <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => handleNotifToggle(key)} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="ui-card rounded-[24px] space-y-4 px-4 py-5">
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
            className="hd-soft-button inline-flex min-h-11 w-full items-center justify-center px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearingPwaCache
              ? t('settings.cache.clearing', 'Nettoyage en cours...')
              : t('settings.cache.action', 'Vider tout le cache utilisateur')}
          </button>
          <button
            type="button"
            onClick={handleHardRefresh}
            disabled={hardRefreshing || clearingPwaCache}
            className="hd-primary-button inline-flex min-h-11 w-full items-center justify-center px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
