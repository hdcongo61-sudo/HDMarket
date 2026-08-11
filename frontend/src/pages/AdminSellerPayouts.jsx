import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Store,
  WalletCards,
  X
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { appConfirm } from '../utils/appDialog';
import { AdminCommandHero, AdminSegmentedControl } from '../components/admin/AdminCommandSurface';
import {
  countPayoutsByGroup,
  filterSellerPayouts,
  summarizeSellerPayouts
} from '../utils/sellerPayoutFilters';

const STATUS_CONFIG = {
  CREATED: {
    label: 'Créé',
    icon: Clock3,
    className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300'
  },
  PROCESSING: {
    label: 'En traitement',
    icon: RefreshCw,
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
  },
  ENQUEUED: {
    label: 'Chez l’opérateur',
    icon: Clock3,
    className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
  },
  COMPLETED: {
    label: 'Versé',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
  },
  FAILED: {
    label: 'Échec',
    icon: AlertCircle,
    className: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
  },
  NEEDS_ATTENTION: {
    label: 'À vérifier',
    icon: AlertCircle,
    className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300'
  },
  CANCELLED: {
    label: 'Annulé',
    icon: X,
    className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  }
};

const PROVIDER_OPTIONS = [
  { value: 'all', label: 'Tous les opérateurs' },
  { value: 'MTN_MOMO_COG', label: 'MTN MoMo' },
  { value: 'AIRTEL_COG', label: 'Airtel Money' }
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' }
];

const formatDateTime = (value) => {
  if (!value) return 'Non renseigné';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non renseigné';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const providerLabel = (provider) => {
  if (provider === 'MTN_MOMO_COG') return 'MTN MoMo';
  if (provider === 'AIRTEL_COG') return 'Airtel Money';
  return provider || 'Opérateur inconnu';
};

const failureMessage = (failureReason) => {
  if (!failureReason) return '';
  if (typeof failureReason === 'string') return failureReason;
  return (
    failureReason.failureMessage ||
    failureReason.message ||
    failureReason.failureCode ||
    'PawaPay a signalé un échec sans précision.'
  );
};

function PayoutSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Inconnu',
    icon: AlertCircle,
    className: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
      {config.label || status}
    </span>
  );
}

export default function AdminSellerPayouts() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [action, setAction] = useState({ id: '', type: '' });
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [providerFilter, setProviderFilter] = useState(searchParams.get('provider') || 'all');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort') || 'newest');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const syncUrl = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (!value || value === 'all' || (key === 'sort' && value === 'newest')) next.delete(key);
        else next.set(key, String(value));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setErrorMessage('');
      try {
        const { data } = await api.get('/payments/pawapay/payouts?limit=100');
        setPayouts(Array.isArray(data?.payouts) ? data.payouts : []);
      } catch (error) {
        const message = error.response?.data?.message || 'Impossible de charger les versements.';
        setErrorMessage(message);
        showToast(message, { variant: 'error' });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeSellerPayouts(payouts), [payouts]);
  const filteredPayouts = useMemo(
    () =>
      filterSellerPayouts(payouts, {
        status: statusFilter,
        provider: providerFilter,
        search: searchQuery,
        sort: sortOrder
      }),
    [payouts, providerFilter, searchQuery, sortOrder, statusFilter]
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous', icon: WalletCards, count: payouts.length },
      {
        value: 'attention',
        label: 'À traiter',
        icon: AlertCircle,
        count: countPayoutsByGroup(payouts, 'attention')
      },
      {
        value: 'processing',
        label: 'En cours',
        icon: Clock3,
        count: countPayoutsByGroup(payouts, 'processing')
      },
      {
        value: 'completed',
        label: 'Versés',
        icon: CheckCircle2,
        count: countPayoutsByGroup(payouts, 'completed')
      },
      {
        value: 'cancelled',
        label: 'Annulés',
        icon: X,
        count: countPayoutsByGroup(payouts, 'cancelled')
      }
    ],
    [payouts]
  );

  const hasFilters =
    statusFilter !== 'all' || providerFilter !== 'all' || sortOrder !== 'newest' || searchQuery.trim();

  const resetFilters = () => {
    setStatusFilter('all');
    setProviderFilter('all');
    setSortOrder('newest');
    setSearchQuery('');
    setSearchParams({}, { replace: true });
  };

  const changeFilter = (key, value, setter) => {
    setter(value);
    syncUrl({ [key]: value });
  };

  const retry = async (payout) => {
    const accepted = await appConfirm(
      `Relancer le versement de ${formatPriceWithStoredSettings(payout.amount)} vers ${payout.phoneNumber} ? Une nouvelle demande sera envoyée à PawaPay.`
    );
    if (!accepted) return;

    setAction({ id: payout.payoutId, type: 'retry' });
    try {
      await api.post(`/payments/pawapay/payouts/${encodeURIComponent(payout.payoutId)}/retry`);
      showToast('Nouvelle tentative envoyée à PawaPay.', { variant: 'success' });
      await load({ silent: true });
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de relancer ce versement.', {
        variant: 'error'
      });
    } finally {
      setAction({ id: '', type: '' });
    }
  };

  const refresh = async (payout) => {
    setAction({ id: payout.payoutId, type: 'refresh' });
    try {
      await api.post(`/payments/pawapay/payouts/${encodeURIComponent(payout.payoutId)}/refresh`);
      showToast('Statut PawaPay actualisé.', { variant: 'success' });
      await load({ silent: true });
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de vérifier ce versement.', {
        variant: 'error'
      });
    } finally {
      setAction({ id: '', type: '' });
    }
  };

  const copyReference = async (reference) => {
    try {
      await navigator.clipboard.writeText(reference);
      showToast('Référence copiée.', { variant: 'success' });
    } catch {
      showToast('Impossible de copier la référence.', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <AdminCommandHero
        eyebrow="Finances · PawaPay"
        title="Versements vendeurs"
        subtitle="Suivez chaque transfert, repérez les blocages et rapprochez les versements avec les commandes concernées."
        meta="Les 100 versements les plus récents sont affichés."
        metrics={[
          { label: 'Versements', value: summary.total, help: 'dans la liste', icon: WalletCards },
          {
            label: 'Déjà versé',
            value: formatPriceWithStoredSettings(summary.completedAmount),
            help: `${summary.completed} terminé${summary.completed > 1 ? 's' : ''}`,
            icon: CheckCircle2
          },
          { label: 'À traiter', value: summary.attention, help: 'échec ou vérification', icon: AlertCircle },
          { label: 'En transit', value: summary.processing, help: 'chez PawaPay', icon: Clock3 }
        ]}
        actions={[
          {
            label: 'Actualiser les versements',
            description: 'Recharger la liste depuis HDMarket',
            icon: RefreshCw,
            tone: 'orange',
            onClick: () => load(),
            loading
          },
          {
            label: 'Vérification des paiements',
            description: 'Ouvrir le centre financier',
            icon: ShieldCheck,
            tone: 'neutral',
            to: '/admin/payment-verification'
          }
        ]}
      />

      <section className="space-y-3" aria-label="Filtres des versements">
        <AdminSegmentedControl
          options={statusOptions}
          value={statusFilter}
          onChange={(value) => changeFilter('status', value, setStatusFilter)}
        />

        <div className="grid gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:grid-cols-[minmax(240px,1fr)_220px_190px_auto]">
          <label className="relative block">
            <span className="sr-only">Rechercher un versement</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => changeFilter('search', event.target.value, setSearchQuery)}
              placeholder="Boutique, téléphone ou référence…"
              className="min-h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-sm text-neutral-950 outline-none transition focus:border-[#e85d00] focus:ring-2 focus:ring-orange-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:ring-orange-950"
            />
          </label>

          <label className="relative block">
            <span className="sr-only">Filtrer par opérateur</span>
            <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <select
              value={providerFilter}
              onChange={(event) => changeFilter('provider', event.target.value, setProviderFilter)}
              className="min-h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-9 text-sm font-semibold text-neutral-700 outline-none focus:border-[#e85d00] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </label>

          <label className="relative block">
            <span className="sr-only">Trier les versements</span>
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <select
              value={sortOrder}
              onChange={(event) => changeFilter('sort', event.target.value, setSortOrder)}
              className="min-h-11 w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-9 text-sm font-semibold text-neutral-700 outline-none focus:border-[#e85d00] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          </label>

          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              <X className="h-4 w-4" /> Réinitialiser
            </button>
          ) : null}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
          {filteredPayouts.length} résultat{filteredPayouts.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Plus récents en premier par défaut</p>
      </div>

      {errorMessage ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm font-semibold">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => load()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-700 px-3 text-sm font-bold text-white">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-label="Chargement des versements">
          {Array.from({ length: 3 }).map((_, index) => <PayoutSkeleton key={index} />)}
        </div>
      ) : !filteredPayouts.length && !errorMessage ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-12 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300">
            <WalletCards className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-base font-black text-neutral-950 dark:text-white">
            {payouts.length ? 'Aucun versement ne correspond aux filtres' : 'Aucun versement vendeur'}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            {payouts.length
              ? 'Essayez une autre recherche ou réinitialisez les filtres.'
              : 'Les futurs transferts vers les vendeurs apparaîtront ici.'}
          </p>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="mt-4 min-h-11 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white dark:bg-white dark:text-neutral-950">
              Afficher tous les versements
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayouts.map((payout) => {
            const isBusy = action.id === payout.payoutId;
            const settlements = Array.isArray(payout.settlements) ? payout.settlements : [];
            const sellerName = payout.seller?.shopName || payout.seller?.name || 'Boutique';
            const initials = sellerName.trim().slice(0, 2).toUpperCase();
            const failure = failureMessage(payout.failureReason);
            const canRefresh = ['CREATED', 'PROCESSING', 'ENQUEUED', 'NEEDS_ATTENTION'].includes(payout.status);

            return (
              <article key={payout._id || payout.payoutId} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF0E4] text-sm font-black text-[#e85d00] dark:bg-orange-950/40 dark:text-orange-300">
                        {initials || <Store className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-black text-neutral-950 dark:text-white">{sellerName}</h2>
                          <StatusBadge status={payout.status} />
                        </div>
                        <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
                          {[payout.seller?.name !== sellerName ? payout.seller?.name : '', payout.seller?.email]
                            .filter(Boolean)
                            .join(' · ') || 'Identité vendeur non renseignée'}
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xl font-black text-neutral-950 dark:text-white">{formatPriceWithStoredSettings(payout.amount)}</p>
                      <p className="mt-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Montant net envoyé</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Destination</p>
                      <p className="mt-1 text-sm font-bold text-neutral-900 dark:text-white">{providerLabel(payout.provider)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{payout.phoneNumber || 'Numéro absent'}</p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Rapprochement</p>
                      <p className="mt-1 text-sm font-bold text-neutral-900 dark:text-white">{settlements.length} règlement{settlements.length > 1 ? 's' : ''}</p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">commandes regroupées</p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Créé le</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-neutral-900 dark:text-white">{formatDateTime(payout.createdAt)}</p>
                    </div>
                    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Dernier contrôle</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-neutral-900 dark:text-white">{formatDateTime(payout.lastProviderStatusCheckAt || payout.updatedAt)}</p>
                    </div>
                  </div>

                  {failure ? (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{failure}</span>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-neutral-100 bg-neutral-50/70 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <details className="group min-w-0">
                      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-bold text-neutral-600 dark:text-neutral-300">
                        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                        Détails et références
                      </summary>
                      <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:min-w-[520px]">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">ID du versement</p>
                            <div className="mt-1 flex items-start gap-2">
                              <code className="min-w-0 break-all text-xs text-neutral-700 dark:text-neutral-300">{payout.payoutId || '-'}</code>
                              {payout.payoutId ? (
                                <button type="button" onClick={() => copyReference(payout.payoutId)} className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900" aria-label="Copier l’identifiant du versement">
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Transaction opérateur</p>
                            <code className="mt-1 block break-all text-xs text-neutral-700 dark:text-neutral-300">{payout.providerTransactionId || 'Pas encore attribuée'}</code>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Demande initiée</p>
                            <p className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{formatDateTime(payout.initiatedAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Finalisée</p>
                            <p className="mt-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300">{formatDateTime(payout.completedAt || payout.failedAt)}</p>
                          </div>
                        </div>

                        {settlements.length ? (
                          <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-400">Règlements inclus</p>
                            <div className="space-y-2">
                              {settlements.map((settlement, index) => (
                                <div key={settlement._id || index} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-900">
                                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                                    Commande {settlement.order?._id ? `#${String(settlement.order._id).slice(-8).toUpperCase()}` : index + 1}
                                  </span>
                                  <span className="font-black text-neutral-950 dark:text-white">{formatPriceWithStoredSettings(settlement.netAmount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {payout.status === 'FAILED' ? (
                        <button
                          type="button"
                          onClick={() => retry(payout)}
                          disabled={isBusy}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-950 sm:flex-none"
                        >
                          <RefreshCw className={`h-4 w-4 ${isBusy && action.type === 'retry' ? 'animate-spin' : ''}`} />
                          {isBusy && action.type === 'retry' ? 'Relance…' : 'Relancer le versement'}
                        </button>
                      ) : null}
                      {canRefresh ? (
                        <button
                          type="button"
                          onClick={() => refresh(payout)}
                          disabled={isBusy}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 sm:flex-none"
                        >
                          <RefreshCw className={`h-4 w-4 ${isBusy && action.type === 'refresh' ? 'animate-spin' : ''}`} />
                          {isBusy && action.type === 'refresh' ? 'Vérification…' : 'Vérifier chez PawaPay'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredPayouts.length ? (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-neutral-400">
          <CalendarDays className="h-3.5 w-3.5" /> Liste limitée aux 100 versements les plus récents
        </div>
      ) : null}
    </div>
  );
}
