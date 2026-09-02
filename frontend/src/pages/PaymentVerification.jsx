import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ShieldCheckIcon, UserMinusIcon, UserPlusIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { appAlert, appConfirm } from '../utils/appDialog';
import { hasAnyPermission } from '../utils/permissions';
import {
  getPaymentPeriodStart,
  sortPaymentsByRecency
} from '../utils/paymentVerificationFilters';
import { AdminCommandHero, AdminSegmentedControl } from '../components/admin/AdminCommandSurface';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'waiting', label: 'À vérifier', icon: ClockIcon },
  { value: 'verified', label: 'Validés', icon: CheckCircleIcon },
  { value: 'rejected', label: 'Rejetés', icon: XCircleIcon }
];

const PANEL_OPTIONS = [
  { value: 'payments', label: 'Paiements', icon: CreditCardIcon },
  { value: 'verifiers', label: 'Vérificateurs', icon: ShieldCheckIcon }
];

const OPERATOR_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les opérateurs' },
  { value: 'MTN_MONEY', label: 'MTN MoMo' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'OTHER', label: 'Autre opérateur' }
];

const METHOD_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les moyens' },
  { value: 'mobile_money', label: 'Mobile Money manuel' },
  { value: 'pawapay', label: 'PawaPay' },
  { value: 'promo', label: 'Code promotionnel' }
];

const PERIOD_FILTER_OPTIONS = [
  { value: 'all', label: 'Toute la période' },
  { value: 'today', label: "Aujourd’hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' }
];

const SORT_FILTER_OPTIONS = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' }
];

const paymentStatusLabels = {
  waiting: 'À vérifier',
  verified: 'Validé',
  rejected: 'Rejeté'
};

const paymentStatusStyles = {
  waiting: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  verified: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
};

const operatorStyles = {
  MTN: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
  MTN_MONEY: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300',
  Airtel: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  AIRTEL_MONEY: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  Orange: 'bg-gray-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  ORANGE_MONEY: 'bg-gray-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  Moov: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
  OTHER: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
  Other: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
};

const operatorLabels = {
  MTN: 'MTN MoMo',
  MTN_MONEY: 'MTN MoMo',
  Airtel: 'Airtel Money',
  AIRTEL_MONEY: 'Airtel Money',
  Orange: 'Orange Money',
  ORANGE_MONEY: 'Orange Money',
  Moov: 'Moov Money',
  OTHER: 'Autre',
  Other: 'Autre'
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getProductImage = (product) => {
  const firstImage = Array.isArray(product?.images) ? product.images[0] : null;
  if (!firstImage) return '';
  if (typeof firstImage === 'string') return firstImage;
  return firstImage.url || firstImage.secureUrl || '';
};

const getProductLink = (product) => {
  if (!product) return '';
  if (product.slug) return `/product/${product.slug}`;
  if (product._id) return `/products/${product._id}`;
  return '';
};

function PaymentSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-3 w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>
    </div>
  );
}

function UserIdentity({ user }) {
  const initials = String(user?.name || user?.email || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
        {initials || 'U'}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-neutral-950 dark:text-white">{user?.name || 'Utilisateur'}</p>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {[user?.email, user?.phone].filter(Boolean).join(' · ') || 'Coordonnées non définies'}
        </p>
      </div>
    </div>
  );
}

export default function PaymentVerification({ initialPanel = 'payments' }) {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const canOpenPawaPayCenter = user?.role === 'admin' || user?.role === 'founder';
  const canManageVerifiers =
    user?.role === 'admin' || user?.role === 'founder' || hasAnyPermission(user, ['manage_permissions']);

  const requestedPanel = searchParams.get('panel') || initialPanel;
  const [activePanel, setActivePanel] = useState(
    requestedPanel === 'verifiers' && canManageVerifiers ? 'verifiers' : 'payments'
  );
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get('status') || 'waiting');
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('search') || '');
  const [operatorFilter, setOperatorFilter] = useState(searchParams.get('operator') || 'all');
  const [methodFilter, setMethodFilter] = useState(searchParams.get('method') || 'all');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') || 'all');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sort') || 'newest');
  const [paymentAction, setPaymentAction] = useState({ id: '', type: '' });

  const [verifiers, setVerifiers] = useState([]);
  const [loadingVerifiers, setLoadingVerifiers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);
  const [verifierActionId, setVerifierActionId] = useState('');

  useEffect(() => {
    const nextPanel = searchParams.get('panel') || initialPanel;
    if (nextPanel === 'verifiers' && canManageVerifiers) {
      setActivePanel('verifiers');
    }
  }, [canManageVerifiers, initialPanel, searchParams]);

  const syncUrl = useCallback(
    (patch = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const changePanel = (panel) => {
    if (panel === 'verifiers' && !canManageVerifiers) return;
    setActivePanel(panel);
    syncUrl({ panel: panel === 'payments' ? '' : panel });
  };

  const changePaymentStatus = (status) => {
    setPaymentStatus(status);
    syncUrl({ status: status === 'waiting' ? '' : status });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadPayments = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingPayments(true);
    setPaymentsError('');
    try {
      const params = new URLSearchParams();
      params.set('status', paymentStatus || 'waiting');
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
      if (operatorFilter !== 'all') params.set('operator', operatorFilter);
      if (methodFilter !== 'all') params.set('paymentMethod', methodFilter);
      const startDate = getPaymentPeriodStart(periodFilter);
      if (startDate) params.set('startDate', startDate);
      params.set('sort', sortOrder === 'oldest' ? 'oldest' : 'newest');

      const { data } = await api.get(`/payments/admin?${params.toString()}`);
      setPayments(sortPaymentsByRecency(data, sortOrder));
    } catch (error) {
      console.error('Load payments error:', error);
      setPaymentsError(error?.response?.data?.message || 'Impossible de charger les paiements.');
      setPayments([]);
    } finally {
      if (!silent) setLoadingPayments(false);
    }
  }, [debouncedSearchQuery, methodFilter, operatorFilter, paymentStatus, periodFilter, sortOrder]);

  const changeFilter = (key, value, setter, defaultValue = 'all') => {
    setter(value);
    syncUrl({ [key]: value === defaultValue ? '' : value });
  };

  const resetPaymentFilters = () => {
    setOperatorFilter('all');
    setMethodFilter('all');
    setPeriodFilter('all');
    setSortOrder('newest');
    syncUrl({ operator: '', method: '', period: '', sort: '' });
  };

  const loadVerifiers = useCallback(async () => {
    if (!canManageVerifiers) return;
    setLoadingVerifiers(true);
    try {
      const { data } = await api.get('/admin/payment-verifiers');
      setVerifiers(Array.isArray(data?.verifiers) ? data.verifiers : []);
    } catch (error) {
      console.error('Load verifiers error:', error);
      setVerifiers([]);
    } finally {
      setLoadingVerifiers(false);
    }
  }, [canManageVerifiers]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (canManageVerifiers) {
      loadVerifiers();
    }
  }, [canManageVerifiers, loadVerifiers]);

  useEffect(() => {
    const handlePaymentStatusChange = () => loadPayments({ silent: true });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadPayments({ silent: true });
    };

    window.addEventListener('paymentStatusChanged', handlePaymentStatusChange);
    window.addEventListener('focus', handlePaymentStatusChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('paymentStatusChanged', handlePaymentStatusChange);
      window.removeEventListener('focus', handlePaymentStatusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadPayments]);

  const visiblePanelOptions = useMemo(
    () => PANEL_OPTIONS.filter((option) => option.value !== 'verifiers' || canManageVerifiers),
    [canManageVerifiers]
  );

  const displayedPaymentAmount = useMemo(
    () => payments.reduce(
      (sum, payment) => sum + Number(payment?.amountPaid ?? payment?.amount ?? 0),
      0
    ),
    [payments]
  );

  const paymentMetrics = [
    {
      label: paymentStatusLabels[paymentStatus] || 'Paiements',
      value: loadingPayments ? '...' : payments.length,
      help: 'File affichée',
      icon: CreditCardIcon
    },
    {
      label: 'Montant affiché',
      value: loadingPayments ? '...' : formatCurrency(displayedPaymentAmount),
      help: 'Selon les filtres actifs',
      icon: CreditCardIcon
    },
    {
      label: 'Vérificateurs',
      value: canManageVerifiers ? verifiers.length : '-',
      help: canManageVerifiers ? 'Autorisés' : 'Admin only',
      icon: UserPlusIcon
    },
    {
      label: 'Action',
      value: paymentStatus === 'waiting' ? 'Manuelle' : 'Historique',
      help: paymentStatus === 'waiting' ? 'Valider ou rejeter' : 'Consultation',
      icon: ShieldCheckIcon
    }
  ];

  const handleVerify = async (paymentId, paymentKind = '') => {
    const confirmationMessage =
      paymentKind === 'LISTING_FEE_RECONCILIATION'
        ? 'Valider ce complément et publier le nouveau prix ?'
        : 'Voulez-vous vérifier ce paiement ? Le produit sera approuvé.';
    if (!(await appConfirm(confirmationMessage))) return;

    const previousPayments = payments;
    setPayments((prev) => prev.filter((item) => item?._id !== paymentId));
    setPaymentAction({ id: paymentId, type: 'verify' });
    try {
      await api.put(`/payments/admin/${paymentId}/verify`);
      appAlert('Paiement vérifié avec succès.');
      window.dispatchEvent(new CustomEvent('paymentStatusChanged', { detail: { paymentId, status: 'verified' } }));
    } catch (error) {
      console.error('Verify payment error:', error);
      setPayments(previousPayments);
      appAlert(error.response?.data?.message || 'Erreur lors de la vérification.');
    } finally {
      setPaymentAction({ id: '', type: '' });
    }
  };

  const handleReject = async (paymentId, paymentKind = '') => {
    const confirmationMessage =
      paymentKind === 'LISTING_FEE_RECONCILIATION'
        ? 'Rejeter ce complément ? L’ancien prix restera visible.'
        : 'Voulez-vous rejeter ce paiement ? Le produit sera rejeté.';
    if (!(await appConfirm(confirmationMessage))) return;

    const previousPayments = payments;
    setPayments((prev) => prev.filter((item) => item?._id !== paymentId));
    setPaymentAction({ id: paymentId, type: 'reject' });
    try {
      await api.put(`/payments/admin/${paymentId}/reject`);
      appAlert('Paiement rejeté.');
      window.dispatchEvent(new CustomEvent('paymentStatusChanged', { detail: { paymentId, status: 'rejected' } }));
    } catch (error) {
      console.error('Reject payment error:', error);
      setPayments(previousPayments);
      appAlert(error.response?.data?.message || 'Erreur lors du rejet.');
    } finally {
      setPaymentAction({ id: '', type: '' });
    }
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`);
      const users = Array.isArray(data) ? data.filter((item) => !['admin', 'founder'].includes(item.role)) : [];
      setFoundUsers(users);
    } catch (error) {
      console.error('MagnifyingGlassIcon users error:', error);
      setFoundUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleToggleVerifier = async (userId) => {
    if (!/^[0-9a-fA-F]{24}$/.test(String(userId || ''))) {
      appAlert('ID utilisateur invalide.');
      return;
    }

    setVerifierActionId(userId);
    try {
      const { data } = await api.patch(`/admin/payment-verifiers/${userId}/toggle`);
      appAlert(data?.message || 'Permission mise à jour.');
      await loadVerifiers();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (error) {
      console.error('Toggle verifier error:', error);
      appAlert(error.response?.data?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setVerifierActionId('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 px-3 py-4 text-neutral-950 dark:bg-neutral-950 dark:text-white sm:px-4 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <AdminCommandHero
          eyebrow="Finances"
          title="Vérification des paiements"
          subtitle="Suivez les confirmations PawaPay, les rapprochements automatiques et l’historique des paiements antérieurs."
          meta="Les validations manuelles restent traçables et synchronisées avec le centre de commande."
          metrics={paymentMetrics}
          actions={[
            {
              label: 'Actualiser',
              description: activePanel === 'verifiers' ? 'Recharger les vérificateurs' : 'Recharger la file paiement',
              icon: ArrowPathIcon,
              tone: 'dark',
              loading: loadingPayments || loadingVerifiers,
              onClick: () => {
                loadPayments({ silent: activePanel === 'verifiers' });
                if (canManageVerifiers) loadVerifiers();
              }
            },
            canManageVerifiers
              ? {
                  label: 'Vérificateurs',
                  description: 'Ajouter ou retirer un accès',
                  icon: ShieldCheckIcon,
                  tone: activePanel === 'verifiers' ? 'emerald' : 'neutral',
                  onClick: () => changePanel('verifiers')
                }
              : null,
            canOpenPawaPayCenter
              ? {
                  label: 'Centre PawaPay',
                  description: 'Encaissements, incidents et rapprochements',
                  icon: CreditCardIcon,
                  tone: 'orange',
                  to: '/admin/pawapay'
                }
              : null
          ].filter(Boolean)}
        />

        {paymentsError && activePanel === 'payments' ? (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{paymentsError}</span>
          </div>
        ) : null}

        <AdminSegmentedControl
          options={visiblePanelOptions.map((option) => ({
            ...option,
            count: option.value === 'payments' ? payments.length : verifiers.length
          }))}
          value={activePanel}
          onChange={changePanel}
        />

        {activePanel === 'payments' ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    className="min-h-[46px] w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm font-medium text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-600"
                    placeholder="Rechercher par nom de produit..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <AdminSegmentedControl
                  className="border-0 bg-transparent p-0 shadow-none"
                  options={PAYMENT_STATUS_OPTIONS.map((option) => ({
                    ...option,
                    count: option.value === paymentStatus ? payments.length : 0
                  }))}
                  value={paymentStatus}
                  onChange={changePaymentStatus}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] dark:border-neutral-800">
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Opérateur
                  <select
                    value={operatorFilter}
                    onChange={(event) => changeFilter('operator', event.target.value, setOperatorFilter)}
                    className="min-h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-bold normal-case tracking-normal text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {OPERATOR_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Moyen
                  <select
                    value={methodFilter}
                    onChange={(event) => changeFilter('method', event.target.value, setMethodFilter)}
                    className="min-h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-bold normal-case tracking-normal text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {METHOD_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Période
                  <select
                    value={periodFilter}
                    onChange={(event) => changeFilter('period', event.target.value, setPeriodFilter)}
                    className="min-h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-bold normal-case tracking-normal text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {PERIOD_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                  Ordre
                  <select
                    value={sortOrder}
                    onChange={(event) => changeFilter('sort', event.target.value, setSortOrder, 'newest')}
                    className="min-h-11 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs font-bold normal-case tracking-normal text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {SORT_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                {(operatorFilter !== 'all' || methodFilter !== 'all' || periodFilter !== 'all' || sortOrder !== 'newest') ? (
                  <button
                    type="button"
                    onClick={resetPaymentFilters}
                    className="col-span-2 min-h-11 self-end rounded-xl border border-neutral-200 px-3 text-xs font-bold text-neutral-600 hover:bg-neutral-50 sm:col-span-4 lg:col-span-1 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  >
                    Réinitialiser
                  </button>
                ) : null}
              </div>
            </div>

            {loadingPayments ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <PaymentSkeleton key={index} />
                ))}
              </div>
            ) : null}

            {!loadingPayments && payments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300">
                  <CreditCardIcon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-bold text-neutral-950 dark:text-white">Aucun paiement à afficher</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  La file {paymentStatusLabels[paymentStatus]?.toLowerCase() || 'sélectionnée'} est vide pour ces filtres.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3">
              {!loadingPayments && payments.map((payment) => {
                const productImage = getProductImage(payment.product);
                const productLink = getProductLink(payment.product);
                const isRowLoading = paymentAction.id === payment._id;
                const isVerifyLoading = isRowLoading && paymentAction.type === 'verify';
                const isRejectLoading = isRowLoading && paymentAction.type === 'reject';
                const status = payment.status || paymentStatus;

                return (
                  <article
                    key={payment._id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="grid gap-4 p-4 lg:grid-cols-[128px_minmax(0,1fr)_220px] lg:items-start">
                      <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={payment.product?.title || 'Produit'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-neutral-400">
                            <CreditCardIcon className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paymentStatusStyles[status] || paymentStatusStyles.waiting}`}>
                            {paymentStatusLabels[status] || status}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${operatorStyles[payment.operator] || operatorStyles.Other}`}>
                            {operatorLabels[payment.operator] || payment.operator || 'Opérateur inconnu'}
                          </span>
                          {payment.promoCodeValue ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              Promo {payment.promoCodeValue}
                            </span>
                          ) : null}
                          {payment.paymentKind === 'LISTING_FEE_RECONCILIATION' ? (
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                              Complément changement de prix
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-start gap-2">
                          <h2 className="min-w-0 truncate text-base font-bold text-neutral-950 dark:text-white">
                            {payment.product?.title || 'Produit supprimé'}
                          </h2>
                          {productLink ? (
                            <Link
                              to={productLink}
                              target="_blank"
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-950 dark:hover:bg-neutral-900 dark:hover:text-white"
                              title="Voir le produit"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </Link>
                          ) : null}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-300 sm:grid-cols-2">
                          <p>
                            <span className="text-neutral-400">Payeur: </span>
                            <span className="font-semibold text-neutral-900 dark:text-white">{payment.payerName || '-'}</span>
                          </p>
                          <p>
                            <span className="text-neutral-400">Vendeur: </span>
                            <span className="font-semibold text-neutral-900 dark:text-white">{payment.user?.name || '-'}</span>
                          </p>
                          <p>
                            <span className="text-neutral-400">Transaction: </span>
                            <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
                              {payment.transactionNumber || payment.transactionId || '-'}
                            </span>
                          </p>
                          <p>
                            <span className="text-neutral-400">Soumis: </span>
                            <span className="font-medium">{formatDateTime(payment.submittedAt || payment.createdAt)}</span>
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/70 sm:grid-cols-3">
                          <p>
                            <span className="block text-[11px] font-bold uppercase text-neutral-400">Payé</span>
                            <span className="font-bold text-neutral-950 dark:text-white">{formatCurrency(payment.amount)}</span>
                          </p>
                          <p>
                            <span className="block text-[11px] font-bold uppercase text-neutral-400">Commission</span>
                            <span className="font-bold text-neutral-950 dark:text-white">
                              {formatCurrency(payment.commissionDueAmount ?? payment.amount)}
                            </span>
                          </p>
                          <p>
                            <span className="block text-[11px] font-bold uppercase text-neutral-400">Prix produit</span>
                            <span className="font-bold text-neutral-950 dark:text-white">
                              {payment.paymentKind === 'LISTING_FEE_RECONCILIATION'
                                ? `${formatCurrency(payment.oldPrice)} → ${formatCurrency(payment.newPrice)}`
                                : formatCurrency(payment.product?.price)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 lg:flex-col">
                        {status === 'waiting' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleVerify(payment._id, payment.paymentKind)}
                              disabled={isRowLoading}
                              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60"
                            >
                              {isVerifyLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(payment._id, payment.paymentKind)}
                              disabled={isRowLoading}
                              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                            >
                              {isRejectLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <XCircleIcon className="h-4 w-4" />}
                              Rejeter
                            </button>
                          </>
                        ) : (
                          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                            <p className="font-bold text-neutral-800 dark:text-neutral-100">Action clôturée</p>
                            <p className="mt-1">
                              {payment.validatedBy?.name ? `Par ${payment.validatedBy.name}` : 'Historique disponible.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {activePanel === 'verifiers' && canManageVerifiers ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-200">
                  <UserPlusIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-950 dark:text-white">Ajouter un vérificateur</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Cherchez un utilisateur et donnez-lui uniquement le droit de vérifier les paiements.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Nom, email ou téléphone..."
                  value={userSearchQuery}
                  onChange={(event) => setUserSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSearchUsers();
                  }}
                  className="min-h-[46px] min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-medium text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSearchUsers}
                  disabled={searchingUsers || !userSearchQuery.trim()}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950"
                >
                  {searchingUsers ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MagnifyingGlassIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">Chercher</span>
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {foundUsers.map((foundUser) => {
                  const id = foundUser._id || foundUser.id;
                  const isBusy = verifierActionId === id;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <UserIdentity user={foundUser} />
                      <button
                        type="button"
                        onClick={() => handleToggleVerifier(id)}
                        disabled={isBusy}
                        className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950"
                      >
                        {isBusy ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <UserPlusIcon className="h-3.5 w-3.5" />}
                        Ajouter
                      </button>
                    </div>
                  );
                })}
                {!searchingUsers && userSearchQuery.trim() && foundUsers.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    Aucun utilisateur trouvé pour cette recherche.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-neutral-950 dark:text-white">Vérificateurs actifs</h2>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    {verifiers.length} personne{verifiers.length > 1 ? 's' : ''} autorisée{verifiers.length > 1 ? 's' : ''}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadVerifiers}
                  disabled={loadingVerifiers}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  aria-label="Actualiser les vérificateurs"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${loadingVerifiers ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {loadingVerifiers ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                    Chargement des vérificateurs...
                  </div>
                ) : null}
                {!loadingVerifiers && verifiers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-300 p-4 dark:border-neutral-800">
                    <div className="flex items-start gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      Aucun vérificateur dédié. Les admins et founders gardent leurs accès via leurs rôles.
                    </div>
                  </div>
                ) : null}
                {!loadingVerifiers && verifiers.map((verifier) => {
                  const isBusy = verifierActionId === verifier.id;
                  return (
                    <div
                      key={verifier.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <UserIdentity user={verifier} />
                      <button
                        type="button"
                        onClick={() => handleToggleVerifier(verifier.id)}
                        disabled={isBusy}
                        className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                      >
                        {isBusy ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <UserMinusIcon className="h-3.5 w-3.5" />}
                        Retirer
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
