import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Bot,
  ChevronRight,
  Coins,
  Globe,
  Monitor,
  Moon,
  Palette,
  RefreshCcw,
  ShieldAlert,
  Sun
} from 'lucide-react';
import { resolveUserProfileImage } from '../utils/userAvatar';
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
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="text-sm font-medium text-gray-700 dark:text-neutral-200">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#e85d00]' : 'bg-black/15 dark:bg-white/25'
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

// ── Settings card with an accent icon chip + heading ──
const SectionCard = ({ id, icon: Icon, title, subtitle, action, children }) => (
  <section id={id} className="ui-card scroll-mt-28 rounded-2xl p-4">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e85d00]/10 text-[#e85d00]">
          <Icon size={17} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-black text-gray-900 dark:text-white">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-500 dark:text-neutral-400">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
    {children && <div className="mt-3.5">{children}</div>}
  </section>
);

// ── A labelled row inside a card (for stacked selectors) ──
const SettingRow = ({ label, children }) => (
  <div className="space-y-2 py-3 first:pt-0 last:pb-0">
    <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{label}</p>
    {children}
  </div>
);

// ── A notification category with a colored dot ──
const NotifGroup = ({ dotClass, title, items, notifPrefs, onToggle }) => (
  <div className="py-1.5">
    <p className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-neutral-400">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {title}
    </p>
    {items.map(([key, label]) => (
      <NotifToggle key={key} label={label} checked={!!notifPrefs[key]} onChange={() => onToggle(key)} />
    ))}
  </div>
);

export default function UserSettings() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const {
    theme,
    darkThemeEnabled,
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
      { value: 'system', label: t('settings.theme.system', 'Systeme'), icon: Monitor },
      { value: 'light', label: t('settings.theme.light', 'Clair'), icon: Sun },
      { value: 'dark', label: t('settings.theme.dark', 'Sombre'), icon: Moon }
    ],
    [t]
  );

  const previewPrice = useMemo(() => formatPrice(125000), [formatPrice]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (location.hash !== '#notifications') return undefined;
    const timeoutId = window.setTimeout(() => {
      document.getElementById('notifications')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [location.hash]);

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
      <header className="ui-glass-header">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/profile"
            className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center"
            aria-label={t('settings.back', 'Retour')}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-gray-900 dark:text-white">{t('settings.title', 'Parametres')}</h1>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
              <span className={`h-1.5 w-1.5 rounded-full ${savingPreferences ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />
              {savingPreferences ? t('settings.syncing', 'Synchronisation en cours...') : t('settings.saved', 'Enregistre')}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-24 pt-5">
        <Link
          to="/profile"
          className="ui-card flex items-center gap-3 rounded-2xl p-3.5 transition active:scale-[0.99]"
        >
          {resolveUserProfileImage(user) ? (
            <img
              src={resolveUserProfileImage(user)}
              alt={user?.name || t('settings.user', 'Utilisateur')}
              className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-black/5 dark:ring-white/10"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e85d00] text-xl font-black text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-gray-900 dark:text-white">
              {user?.name || t('settings.user', 'Utilisateur')}
            </p>
            <p className="truncate text-xs font-medium text-gray-500 dark:text-neutral-400">
              {[user?.phone, user?.city].filter(Boolean).join(' · ') || '-'}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#e85d00]">
              {t('settings.editProfile', 'Modifier le profil')}
            </span>
          </div>
          <ChevronRight size={18} className="shrink-0 text-gray-400" />
        </Link>

        <SectionCard
          icon={Globe}
          title={t('settings.localization', 'Région & langue')}
          subtitle={t('settings.localizationDescription', 'Langue, devise et ville de livraison.')}
        >
          <div className="divide-y divide-black/5 dark:divide-white/10">
            <SettingRow label={t('settings.language', 'Langue')}>
              <LanguageSwitcher />
            </SettingRow>
            <SettingRow label={t('settings.currency', 'Devise')}>
              <CurrencySelector />
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-neutral-400">
                <Coins size={12} className="text-[#e85d00]" />
                {t('settings.pricePreview', 'Apercu prix')}: <span className="font-bold text-gray-700 dark:text-neutral-200">{previewPrice}</span>
              </p>
            </SettingRow>
            <SettingRow label={t('settings.city', 'Ville')}>
              <CitySelector />
            </SettingRow>
          </div>
        </SectionCard>

        {darkThemeEnabled ? (
          <SectionCard
            icon={Palette}
            title={t('settings.appearance', 'Apparence')}
            subtitle={t('settings.appearanceDescription', 'Choisissez le thème de l’application.')}
          >
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((item) => {
                const ItemIcon = item.icon;
                const active = theme === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value)}
                    aria-pressed={active}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-bold transition active:scale-[0.97] ${
                      active
                        ? 'border-[#e85d00] bg-[#e85d00]/10 text-[#e85d00]'
                        : 'border-gray-200 text-gray-600 hover:bg-black/[0.03] dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <ItemIcon size={20} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          icon={Bot}
          title={t('settings.assistantChat', 'Assistant chat')}
          subtitle={t(
            'settings.assistantChatDescription',
            'Activez ou desactivez le bouton flottant de l’assistant HDMarket.'
          )}
        >
          <NotifToggle
            label={
              assistantChatEnabled
                ? t('settings.assistantChatEnabled', 'Assistant active')
                : t('settings.assistantChatDisabled', 'Assistant desactive')
            }
            checked={assistantChatEnabled}
            onChange={() => setAssistantChatEnabled(!assistantChatEnabled)}
          />
        </SectionCard>

        {/* ── Notification Preferences ── */}
        <SectionCard
          id="notifications"
          icon={Bell}
          title={t('settings.notifications', 'Notifications')}
          subtitle={t('settings.notifDescription', 'Choisissez les notifications que vous souhaitez recevoir.')}
        >
          {!notifPrefs ? (
            <p className="py-3 text-center text-sm text-gray-400">{t('settings.loading', 'Chargement...')}</p>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/10">
              <NotifGroup
                dotClass="bg-[#e85d00]"
                title={t('settings.notifOrders', 'Commandes')}
                notifPrefs={notifPrefs}
                onToggle={handleNotifToggle}
                items={[
                  ['order_created', t('settings.notifOrderCreated', 'Commande confirmée')],
                  ['order_received', t('settings.notifOrderReceived', 'Nouvelle commande reçue')],
                  ['order_delivering', t('settings.notifOrderDelivering', 'Colis en route')],
                  ['order_delivered', t('settings.notifOrderDelivered', 'Commande livrée')],
                  ['order_cancelled', t('settings.notifOrderCancelled', 'Commande annulée')],
                  ['order_message', t('settings.notifOrderMessage', 'Nouveau message commande')],
                  ['order_reminder', t('settings.notifOrderReminder', 'Rappel de commande')],
                  ['review_reminder', t('settings.notifReviewReminder', 'Rappel d\'avis')]
                ]}
              />
              <NotifGroup
                dotClass="bg-emerald-500"
                title={t('settings.notifPayments', 'Paiements')}
                notifPrefs={notifPrefs}
                onToggle={handleNotifToggle}
                items={[
                  ['payment_pending', t('settings.notifPaymentPending', 'Paiement en attente')],
                  ['installment_due_reminder', t('settings.notifInstallmentDue', 'Échéance approche')],
                  ['installment_overdue_warning', t('settings.notifInstallmentOverdue', 'Tranche en retard')]
                ]}
              />
              <NotifGroup
                dotClass="bg-sky-500"
                title={t('settings.notifSocial', 'Social')}
                notifPrefs={notifPrefs}
                onToggle={handleNotifToggle}
                items={[
                  ['product_comment', t('settings.notifComment', 'Commentaires')],
                  ['reply', t('settings.notifReply', 'Réponses')],
                  ['favorite', t('settings.notifFavorite', 'Ajouts aux favoris')],
                  ['rating', t('settings.notifRating', 'Évaluations')],
                  ['shop_review', t('settings.notifShopReview', 'Avis boutique')],
                  ['shop_follow', t('settings.notifShopFollow', 'Nouveaux abonnés')]
                ]}
              />
              <NotifGroup
                dotClass="bg-violet-500"
                title={t('settings.notifEngagement', 'Découvertes & Bons plans')}
                notifPrefs={notifPrefs}
                onToggle={handleNotifToggle}
                items={[
                  ['price_drop', t('settings.notifPriceDrop', '📉 Baisse de prix sur mes favoris')],
                  ['back_in_stock', t('settings.notifBackInStock', '🔄 Produit de retour en stock')],
                  ['abandoned_cart', t('settings.notifAbandonedCart', '🛒 Rappel panier oublié')],
                  ['seller_new_product', t('settings.notifSellerNewProduct', '🆕 Nouveautés des boutiques suivies')],
                  ['weekly_digest', t('settings.notifWeeklyDigest', '📊 Récap hebdomadaire')]
                ]}
              />
              <NotifGroup
                dotClass="bg-gray-400"
                title={t('settings.notifAccount', 'Compte')}
                notifPrefs={notifPrefs}
                onToggle={handleNotifToggle}
                items={[
                  ['admin_broadcast', t('settings.notifAdminBroadcast', 'Messages HDMarket')],
                  ['account_restriction', t('settings.notifAccountRestriction', 'Restrictions de compte')],
                  ['dispute_created', t('settings.notifDisputeCreated', 'Litiges')]
                ]}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={ShieldAlert}
          title={t('settings.cache.title', 'Maintenance cache')}
          subtitle={t(
            'settings.cache.description',
            'Supprime les caches locaux (PWA, IndexedDB, donnees temporaires) ou force un rechargement immediat.'
          )}
        >
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleHardRefresh}
              disabled={hardRefreshing || clearingPwaCache}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white transition hover:bg-[#f45f00] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={16} className={hardRefreshing ? 'animate-spin' : ''} />
              {hardRefreshing
                ? t('settings.cache.refreshing', 'Actualisation...')
                : t('settings.cache.hardRefresh', 'Hard refresh (forcer)')}
            </button>
            <button
              type="button"
              onClick={handleClearPwaCache}
              disabled={clearingPwaCache}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
            >
              {clearingPwaCache
                ? t('settings.cache.clearing', 'Nettoyage en cours...')
                : t('settings.cache.action', 'Vider tout le cache utilisateur')}
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
