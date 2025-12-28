import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import VerifiedBadge from '../components/VerifiedBadge';
import AuthContext from '../context/AuthContext';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—';
const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';
const formatPercent = (value, total) => {
  if (!total || !value) return '—';
  const percent = (Number(value) / Number(total)) * 100;
  const rounded = percent >= 1 ? percent.toFixed(1) : percent.toFixed(2);
  return `${Number(rounded).toLocaleString('fr-FR')} %`;
};
const formatMonthLabel = (key) => {
  if (!key) return '—';
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const productStatusLabels = {
  pending: 'En attente',
  approved: 'Publiée',
  rejected: 'Rejetée',
  disabled: 'Désactivée'
};

const paymentStatusLabels = {
  waiting: 'En attente',
  verified: 'Validé',
  rejected: 'Rejeté'
};

const paymentStatusStyles = {
  waiting: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

const getPaymentSortValue = (payment, prioritizeUpdated = false) => {
  const candidates = prioritizeUpdated
    ? [payment?.updatedAt, payment?.createdAt, payment?.product?.updatedAt, payment?.product?.createdAt]
    : [payment?.createdAt, payment?.updatedAt, payment?.product?.createdAt, payment?.product?.updatedAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return 0;
};

const PAYMENTS_PER_PAGE = 10;
const USERS_PER_PAGE = 10;

function StatCard({ title, value, subtitle, highlight }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-1">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>{value}</p>
      {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('waiting');
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentSearchDraft, setPaymentSearchDraft] = useState('');
  const [paymentSearchValue, setPaymentSearchValue] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userSearchValue, setUserSearchValue] = useState('');
  const [userAccountFilter, setUserAccountFilter] = useState('person');
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');
  const [verifyingShopId, setVerifyingShopId] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [paymentActionMessage, setPaymentActionMessage] = useState('');
  const [paymentActionError, setPaymentActionError] = useState('');
  const [roleUpdatingId, setRoleUpdatingId] = useState('');
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < 1024;
  });
  const [activeAdminTab, setActiveAdminTab] = useState('overview');
  const externalLinkProps = useDesktopExternalLink();

  const { user: authUser } = useContext(AuthContext);
  const isAdmin = authUser?.role === 'admin';
  const isManager = authUser?.role === 'manager';
  const canViewStats = isAdmin;
  const canManageUsers = isAdmin;
  const canManagePayments = isAdmin || isManager;
  const pageTitle = isManager ? 'Espace gestionnaire' : 'Tableau de bord administrateur';
  const pageSubtitle = isManager
    ? 'Validez les preuves de paiement et contrôlez la mise en ligne des annonces.'
    : 'Visualisez les indicateurs clés de la plateforme et gérez la validation des paiements.';
  const availableTabs = useMemo(() => {
    const tabs = [];
    if (canViewStats) tabs.push({ key: 'overview', label: 'Statistiques' });
    if (canManageUsers) tabs.push({ key: 'users', label: 'Utilisateurs' });
    if (canManagePayments) tabs.push({ key: 'payments', label: 'Paiements' });
    return tabs;
  }, [canViewStats, canManageUsers, canManagePayments]);

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5010/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback(
    (url) => {
      if (!url) return url;
      const cleaned = url.replace(/\\/g, '/');
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
      setStatsError('');
    } catch (e) {
      setStatsError(e.response?.data?.message || e.message || 'Erreur lors du chargement des statistiques.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    const params = new URLSearchParams();
    if (['waiting', 'verified', 'rejected'].includes(filter)) {
      params.append('status', filter);
    }
    if (paymentSearchValue) {
      params.append('search', paymentSearchValue);
    }
    let url = '/payments/admin';
    const query = params.toString();
    if (query) {
      url += `?${query}`;
    }
    const { data } = await api.get(url);
    let normalized = Array.isArray(data)
      ? data.map((payment) => ({
          ...payment,
          product: payment.product
            ? {
                ...payment.product,
                images: Array.isArray(payment.product.images)
                  ? payment.product.images.map(normalizeUrl)
                  : undefined
              }
            : payment.product
        }))
      : [];

    const missingImages = normalized.filter(
      (p) => p.product?._id && (!p.product.images || p.product.images.length === 0)
    );

    if (missingImages.length) {
      const fetched = await Promise.all(
        missingImages.map(async (item) => {
          try {
            const res = await api.get(`/products/${item.product._id}`);
            return { id: item.product._id, images: res.data?.images || [] };
          } catch {
            return { id: item.product._id, images: [] };
          }
        })
      );

      const lookup = new Map(fetched.map(({ id, images }) => [id, images.map(normalizeUrl)]));

      normalized = normalized.map((payment) => {
        const productId = payment.product?._id;
        if (!productId) return payment;
        const extraImages = lookup.get(productId);
        if (!extraImages) return payment;
        return {
          ...payment,
          product: {
            ...payment.product,
            images: extraImages
          }
        };
      });
    }

    if (filter === 'disabled_products') {
      normalized = normalized.filter((item) => item.product?.status === 'disabled');
    }

    const prioritizeUpdated = filter === 'verified';
    normalized = normalized
      .slice()
      .sort(
        (a, b) => getPaymentSortValue(b, prioritizeUpdated) - getPaymentSortValue(a, prioritizeUpdated)
      );

    setPayments(normalized);
    setPaymentsPage((prev) => {
      const totalPages = Math.max(1, Math.ceil(normalized.length / PAYMENTS_PER_PAGE));
      return Math.min(prev, totalPages);
    });
  }, [filter, paymentSearchValue, normalizeUrl]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const params = new URLSearchParams();
      if (userSearchValue) params.append('search', userSearchValue);
      if (userAccountFilter && userAccountFilter !== 'all') params.append('accountType', userAccountFilter);
      const query = params.toString();
      const { data } = await api.get(query ? `/admin/users?${query}` : '/admin/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setUsersError(
        e.response?.data?.message || e.message || 'Erreur lors du chargement des utilisateurs.'
      );
    } finally {
      setUsersLoading(false);
    }
  }, [userAccountFilter, userSearchValue]);

  useEffect(() => {
    if (!canViewStats) return;
    loadStats();
  }, [loadStats, canViewStats]);

  useEffect(() => {
    if (!canManagePayments) return;
    loadPayments();
  }, [loadPayments, canManagePayments]);

  useEffect(() => {
    if (!canManagePayments) return;
    setPaymentsPage(1);
  }, [filter, paymentSearchValue, canManagePayments]);

  useEffect(() => {
    if (canManagePayments) return;
    setPaymentSearchDraft('');
    setPaymentSearchValue('');
  }, [canManagePayments]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setPaymentSearchValue(paymentSearchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [paymentSearchDraft]);

  useEffect(() => {
    if (!canManageUsers) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }
    loadUsers();
  }, [loadUsers, canManageUsers]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setUserSearchValue(userSearchDraft.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [userSearchDraft]);

  useEffect(() => {
    if (!canManageUsers) return;
    setUsersPage(1);
  }, [userAccountFilter, userSearchValue, canManageUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    setUsersPage((prev) => {
      const totalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
      return Math.min(prev, totalPages);
    });
  }, [users.length, canManageUsers]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileView(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!availableTabs.length) return;
    setActiveAdminTab((prev) => {
      const stillValid = availableTabs.some((tab) => tab.key === prev);
      return stillValid ? prev : availableTabs[0].key;
    });
  }, [availableTabs]);

  const actOnPayment = useCallback(
    async (id, type) => {
      try {
        setPaymentActionMessage('');
        setPaymentActionError('');
        if (type === 'verify') await api.put(`/payments/admin/${id}/verify`);
        else await api.put(`/payments/admin/${id}/reject`);
        await loadPayments();
        if (isAdmin) await loadStats();
        setPaymentActionMessage(
          type === 'verify' ? 'Paiement validé avec succès.' : 'Paiement rejeté avec succès.'
        );
      } catch (e) {
        setPaymentActionError(e.response?.data?.message || e.message || 'Action impossible.');
      }
    },
    [isAdmin, loadPayments, loadStats]
  );

  const disableListing = useCallback(
    async (productId) => {
      if (!productId) {
        setPaymentActionError('Annonce introuvable.');
        return;
      }
      try {
        setPaymentActionMessage('');
        setPaymentActionError('');
        await api.patch(`/products/${productId}/disable`);
        await loadPayments();
        if (isAdmin) await loadStats();
        setPaymentActionMessage('Annonce désactivée avec succès.');
      } catch (e) {
        setPaymentActionError(
          e.response?.data?.message || e.message || 'Impossible de désactiver cette annonce.'
        );
      }
    },
    [isAdmin, loadPayments, loadStats]
  );

  const enableListing = useCallback(
    async (productId) => {
      if (!productId) {
        setPaymentActionError('Annonce introuvable.');
        return;
      }
      try {
        setPaymentActionMessage('');
        setPaymentActionError('');
        await api.patch(`/products/${productId}/enable`);
        await loadPayments();
        if (isAdmin) await loadStats();
        setPaymentActionMessage('Annonce réactivée avec succès.');
      } catch (e) {
        setPaymentActionError(
          e.response?.data?.message || e.message || 'Impossible de réactiver cette annonce.'
        );
      }
    },
    [isAdmin, loadPayments, loadStats]
  );

  const copyTransactionNumber = useCallback(async (reference) => {
    if (!reference) {
      setPaymentActionError('Référence de transaction introuvable.');
      return;
    }
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API non disponible');
      await navigator.clipboard.writeText(reference);
      setPaymentActionMessage('Référence copiée dans le presse-papiers.');
      setPaymentActionError('');
    } catch (err) {
      setPaymentActionError('Impossible de copier la référence de transaction.');
      setPaymentActionMessage('');
      console.error(err);
    }
  }, []);

  const handleAccountTypeUpdate = useCallback(
    async (id, targetType, payload = {}) => {
      setUpdatingUserId(id);
      setUsersError('');
      setUserSuccessMessage('');
      try {
        const { data } = await api.patch(`/admin/users/${id}/account-type`, {
          accountType: targetType,
          ...payload
        });

        setUsers((prev) => {
          if (!Array.isArray(prev) || !prev.length) return prev;
          if (targetType === 'shop' && userAccountFilter === 'person') {
            return prev.filter((item) => item.id !== data.id);
          }
          if (targetType === 'person' && userAccountFilter === 'shop') {
            return prev.filter((item) => item.id !== data.id);
          }
          return prev.map((item) => (item.id === data.id ? data : item));
        });

        setEditingUser(null);
        setUserSuccessMessage(
          targetType === 'shop'
            ? 'Le compte a été converti en boutique.'
            : 'Le compte a été converti en particulier.'
        );
        await loadStats();
      } catch (e) {
        setUsersError(
          e.response?.data?.message || e.message || 'Impossible de mettre à jour le compte utilisateur.'
        );
      } finally {
        setUpdatingUserId('');
      }
    },
    [loadStats, userAccountFilter]
  );

  const toggleShopVerification = useCallback(
    async (id, nextValue) => {
      setVerifyingShopId(id);
      setUsersError('');
      setUserSuccessMessage('');
      try {
        const { data } = await api.patch(`/admin/users/${id}/shop-verification`, {
          verified: nextValue
        });
        setUsers((prev) => prev.map((item) => (item.id === data.id ? data : item)));
        setUserSuccessMessage(
          nextValue ? 'La boutique est désormais vérifiée.' : 'Le badge a été retiré.'
        );
      } catch (e) {
        setUsersError(
          e.response?.data?.message ||
            e.message ||
            'Impossible de mettre à jour l’état de vérification.'
        );
      } finally {
        setVerifyingShopId('');
      }
    },
    []
  );

  const handleRoleUpdate = useCallback(
    async (id, targetRole) => {
      setRoleUpdatingId(id);
      setUsersError('');
      setUserSuccessMessage('');
      try {
        const { data } = await api.patch(`/admin/users/${id}/role`, { role: targetRole });
        setUsers((prev) => prev.map((item) => (item.id === data.id ? data : item)));
        setUserSuccessMessage(
          targetRole === 'manager'
            ? 'Utilisateur promu gestionnaire de ventes.'
            : 'Le rôle gestionnaire a été retiré.'
        );
        if (canViewStats) {
          await loadStats();
        }
      } catch (e) {
        setUsersError(
          e.response?.data?.message || e.message || 'Impossible de mettre à jour le rôle utilisateur.'
        );
      } finally {
        setRoleUpdatingId('');
      }
    },
    [canViewStats, loadStats]
  );

  const refreshAll = useCallback(() => {
    if (canViewStats) loadStats();
    if (canManagePayments) loadPayments();
    if (canManageUsers) loadUsers();
  }, [loadStats, loadPayments, loadUsers, canManagePayments, canManageUsers, canViewStats]);

  useEffect(() => {
    if (!paymentActionMessage && !paymentActionError) return;
    const timer = setTimeout(() => {
      setPaymentActionMessage('');
      setPaymentActionError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [paymentActionMessage, paymentActionError]);

  const totalUserCount = stats?.users?.total || 0;
  const totalProductCount = stats?.products?.total || 0;
  const cityStats = Array.isArray(stats?.demographics?.cities) ? stats.demographics.cities : [];
  const genderStats = Array.isArray(stats?.demographics?.genders) ? stats.demographics.genders : [];
  const productCityStats = Array.isArray(stats?.demographics?.productCities)
    ? stats.demographics.productCities
    : [];
  const productGenderStats = Array.isArray(stats?.demographics?.productGenders)
    ? stats.demographics.productGenders
    : [];
  const totalUserPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PER_PAGE;
    return users.slice(start, start + USERS_PER_PAGE);
  }, [users, usersPage]);
  const usersRangeStart = users.length ? (usersPage - 1) * USERS_PER_PAGE + 1 : 0;
  const usersRangeEnd = users.length ? Math.min(usersPage * USERS_PER_PAGE, users.length) : 0;
  const userFilterOptions = [
    { value: 'person', label: 'Particuliers' },
    { value: 'shop', label: 'Boutiques' },
    { value: 'all', label: 'Tous' }
  ];
  const totalPaymentPages = Math.max(1, Math.ceil(payments.length / PAYMENTS_PER_PAGE));
  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * PAYMENTS_PER_PAGE;
    return payments.slice(start, start + PAYMENTS_PER_PAGE);
  }, [payments, paymentsPage]);
  const paymentsRangeStart = payments.length ? (paymentsPage - 1) * PAYMENTS_PER_PAGE + 1 : 0;
  const paymentsRangeEnd = payments.length ? Math.min(paymentsPage * PAYMENTS_PER_PAGE, payments.length) : 0;

  const shouldShowSection = (key) => !isMobileView || activeAdminTab === key;

  const paymentFilterOptions = [
    { value: 'waiting', label: 'En attente' },
    { value: 'verified', label: 'Validés' },
    { value: 'rejected', label: 'Rejetés' },
    { value: 'disabled_products', label: 'Annonces désactivées' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500">{pageSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Actualiser
        </button>
      </header>
      {isMobileView && availableTabs.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveAdminTab(tab.key)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeAdminTab === tab.key
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {canViewStats && shouldShowSection('overview') && (
        <>
          <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vue d'ensemble</h2>
          {stats?.generatedAt && (
            <span className="text-xs text-gray-500">Mise à jour&nbsp;: {formatDateTime(stats.generatedAt)}</span>
          )}
        </div>
        {statsError ? <p className="text-sm text-red-600">{statsError}</p> : null}
        {statsLoading && !stats ? (
          <p className="text-sm text-gray-500">Chargement des statistiques…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Utilisateurs inscrits"
              value={formatNumber(stats?.users?.total)}
              subtitle={`${formatNumber(stats?.users?.newLast30Days)} nouveaux sur 30 jours`}
            />
            <StatCard
              title="Boutiques actives"
              value={formatNumber(stats?.users?.shops)}
              subtitle={`${formatNumber(stats?.users?.admins)} administrateurs`}
            />
            <StatCard
              title="Annonces actives"
              value={formatNumber(stats?.products?.total)}
              subtitle={`${formatNumber(stats?.products?.approved)} publiées`}
            />
            <StatCard
              title="Annonces en attente"
              value={formatNumber(stats?.products?.pending)}
              subtitle={`${formatNumber(stats?.products?.rejected)} rejetées`}
            />
            <StatCard
              title="Paiements en attente"
              value={formatNumber(stats?.payments?.waiting)}
              subtitle={`${formatNumber(stats?.payments?.verified)} validés`}
            />
            <StatCard
              title="Commentaires"
              value={formatNumber(stats?.engagement?.comments)}
              subtitle={`${formatNumber(stats?.engagement?.ratings)} évaluations`}
            />
            <StatCard
              title="CA total"
              value={formatCurrency(stats?.payments?.revenue)}
              subtitle={`${formatCurrency(stats?.payments?.revenueLast30Days)} sur 30 jours`}
              highlight
            />
            <StatCard
              title="Favoris enregistrés"
              value={formatNumber(stats?.engagement?.favorites)}
              subtitle="Total cumulé"
            />
          </div>
        )}
          </section>

          {(cityStats.length > 0 || genderStats.length > 0 || productCityStats.length > 0 || productGenderStats.length > 0) && (
            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {cityStats.length > 0 && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Répartition des utilisateurs par ville</h2>
              <p className="text-xs text-gray-500 mb-3">Principales localisations des membres enregistrés.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 font-medium text-gray-600">Ville</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Utilisateurs</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityStats.slice(0, 8).map((item) => (
                      <tr key={item.city} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700">{item.city}</td>
                        <td className="p-2 text-gray-900 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 text-right">{formatPercent(item.count, totalUserCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {genderStats.length > 0 && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Répartition des utilisateurs par genre</h2>
              <p className="text-xs text-gray-500 mb-3">Déclaration lors de l’inscription.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 font-medium text-gray-600">Genre</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Utilisateurs</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genderStats.map((item) => (
                      <tr key={item.gender} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700">{item.gender}</td>
                        <td className="p-2 text-gray-900 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 text-right">{formatPercent(item.count, totalUserCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {productCityStats.length > 0 && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Annonces par ville</h2>
              <p className="text-xs text-gray-500 mb-3">Localisation déclarée des vendeurs au moment de la publication.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 font-medium text-gray-600">Ville</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Annonces</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productCityStats.slice(0, 8).map((item) => (
                      <tr key={item.city} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700">{item.city}</td>
                        <td className="p-2 text-gray-900 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 text-right">{formatPercent(item.count, totalProductCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {productGenderStats.length > 0 && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Annonces par genre</h2>
              <p className="text-xs text-gray-500 mb-3">Répartition selon le genre des vendeurs.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 font-medium text-gray-600">Genre</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Annonces</th>
                      <th className="p-2 font-medium text-gray-600 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productGenderStats.map((item) => (
                      <tr key={item.gender} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700">{item.gender}</td>
                        <td className="p-2 text-gray-900 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 text-right">{formatPercent(item.count, totalProductCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Tendances des 6 derniers mois</h2>
          <p className="text-xs text-gray-500 mb-3">
            Nouveaux utilisateurs, annonces créées et revenus vérifiés par mois.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 font-medium text-gray-600">Mois</th>
                  <th className="p-2 font-medium text-gray-600">Utilisateurs</th>
                  <th className="p-2 font-medium text-gray-600">Annonces</th>
                  <th className="p-2 font-medium text-gray-600">Revenus</th>
                </tr>
              </thead>
              <tbody>
                {stats?.monthly?.length ? (
                  stats.monthly.map((row) => (
                    <tr key={row.month} className="border-t">
                      <td className="p-2 capitalize">{formatMonthLabel(row.month)}</td>
                      <td className="p-2">{formatNumber(row.newUsers)}</td>
                      <td className="p-2">{formatNumber(row.newProducts)}</td>
                      <td className="p-2">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-sm text-gray-500" colSpan={4}>
                      Aucune donnée disponible pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Catégories les plus actives</h2>
            <p className="text-xs text-gray-500">Top 5 des catégories par nombre d&apos;annonces approuvées.</p>
          </div>
          {stats?.topCategories?.length ? (
            <ul className="space-y-3">
              {stats.topCategories.map((cat) => (
                <li key={cat.category} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cat.category}</p>
                    <p className="text-xs text-gray-500">Prix moyen&nbsp;: {formatCurrency(cat.avgPrice)}</p>
                  </div>
                  <span className="text-sm font-semibold text-indigo-600">
                    {formatNumber(cat.listings)} annonces
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Pas encore assez de données.</p>
          )}
        </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Nouveaux utilisateurs</h3>
          <p className="text-xs text-gray-500 mb-3">5 derniers inscrits sur la plateforme.</p>
          <ul className="space-y-3">
            {stats?.recent?.users?.length ? (
              stats.recent.users.map((user) => (
                <li key={user.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <p className="text-xs text-gray-400">
                    {user.role === 'admin' ? 'Admin · ' : ''}
                    {user.accountType === 'shop' ? 'Boutique' : 'Particulier'} · {formatDate(user.createdAt)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Aucun utilisateur récent.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Dernières annonces</h3>
          <p className="text-xs text-gray-500 mb-3">5 annonces récemment créées.</p>
          <ul className="space-y-3">
            {stats?.recent?.products?.length ? (
              stats.recent.products.map((product) => (
                <li key={product.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900">{product.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(product.price)} · {product.owner || 'Auteur inconnu'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {productStatusLabels[product.status] || product.status} · {formatDate(product.createdAt)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Aucune annonce récente.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Paiements récents</h3>
              <p className="text-xs text-gray-500">5 derniers paiements reçus.</p>
            </div>
            <Link
              to="/admin/payments"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Voir tous →
            </Link>
          </div>
          <ul className="space-y-3">
            {stats?.recent?.payments?.length ? (
              stats.recent.payments.map((payment) => (
                <li key={payment.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{payment.payerName}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        paymentStatusStyles[payment.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {paymentStatusLabels[payment.status] || payment.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(payment.amount)} · {payment.operator}
                  </p>
                  <p className="text-xs text-gray-400">
                    {payment.product || 'Produit inconnu'} · {formatDate(payment.createdAt)}
                  </p>
                  {payment.status === 'verified' && payment.validator && (
                    <p className="text-xs text-green-600 font-medium">
                      Validé par {payment.validator}
                    </p>
                  )}
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Aucun paiement récent.</li>
            )}
          </ul>
        </div>
          </section>
        </>
      )}

      {canManageUsers && shouldShowSection('users') && (
        <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Gestion des utilisateurs</h2>
            <p className="text-xs text-gray-500">
              Recherchez un compte particulier et convertissez-le en boutique si nécessaire.
            </p>
            <Link
              to="/admin/users"
              className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:underline"
            >
              Ouvrir la gestion des suspensions →
            </Link>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setEditingUser(null);
              setUsersError('');
              setUserSuccessMessage('');
            }}
          >
            <input
              type="search"
              className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-60"
              placeholder="Nom, email ou téléphone"
              value={userSearchDraft}
              onChange={(e) => setUserSearchDraft(e.target.value)}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {isMobileView ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                  {userFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setEditingUser(null);
                        setUsersError('');
                        setUserSuccessMessage('');
                        setUserAccountFilter(option.value);
                      }}
                      className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        userAccountFilter === option.value
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={userAccountFilter}
                  onChange={(e) => {
                    setEditingUser(null);
                    setUsersError('');
                    setUserSuccessMessage('');
                    setUserAccountFilter(e.target.value);
                  }}
                >
                  {userFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  disabled={usersLoading}
                >
                  Rechercher
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setEditingUser(null);
                    setUsersError('');
                    setUserSuccessMessage('');
                    setUserSearchDraft('');
                    setUserSearchValue('');
                    setUserAccountFilter('person');
                  }}
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </form>
        </div>
        {usersError ? <p className="text-sm text-red-600">{usersError}</p> : null}
        {userSuccessMessage ? <p className="text-sm text-green-600">{userSuccessMessage}</p> : null}
        {isMobileView ? (
          <div className="space-y-4">
            {usersLoading ? (
              <p className="text-sm text-gray-500">Chargement des utilisateurs…</p>
            ) : paginatedUsers.length ? (
              paginatedUsers.map((user) => {
                const isManagerRole = user.role === 'manager';
                const isAdminRole = user.role === 'admin';
                const isSelf = authUser?.id === user.id;
                const nextRole = isManagerRole ? 'user' : 'manager';
                return (
                  <div key={user.id} className="space-y-3 rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="break-all text-xs text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400">Inscrit le {formatDate(user.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        {user.role}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p>Téléphone : {user.phone || '—'}</p>
                      {user.accountType === 'shop' ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700">
                            Boutique
                          </span>
                          <div className="flex items-center gap-2">
                            <VerifiedBadge verified={Boolean(user.shopVerified)} />
                            {user.shopName ? <span className="truncate">{user.shopName}</span> : null}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                          Particulier
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {user.accountType === 'shop' ? (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            onClick={() => handleAccountTypeUpdate(user.id, 'person')}
                            disabled={updatingUserId === user.id}
                          >
                            Convertir en particulier
                          </button>
                          <button
                            type="button"
                            className={`w-full rounded px-3 py-2 text-xs font-medium text-white ${
                              user.shopVerified ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                            } disabled:opacity-60`}
                            onClick={() => toggleShopVerification(user.id, !user.shopVerified)}
                            disabled={verifyingShopId === user.id}
                          >
                            {user.shopVerified ? 'Retirer le badge' : 'Vérifier la boutique'}
                          </button>
                        </div>
                      ) : editingUser?.id === user.id ? (
                        <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs">
                          <p className="font-semibold text-gray-700">Conversion en boutique</p>
                          <label className="space-y-1 text-gray-600">
                            <span>Nom de la boutique</span>
                            <input
                              type="text"
                              className="w-full rounded border px-2 py-1 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={editingUser.shopName}
                              onChange={(e) =>
                                setEditingUser((prev) =>
                                  prev && prev.id === user.id ? { ...prev, shopName: e.target.value } : prev
                                )
                              }
                              disabled={updatingUserId === user.id}
                            />
                          </label>
                          <label className="space-y-1 text-gray-600">
                            <span>Adresse de la boutique</span>
                            <input
                              type="text"
                              className="w-full rounded border px-2 py-1 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={editingUser.shopAddress}
                              onChange={(e) =>
                                setEditingUser((prev) =>
                                  prev && prev.id === user.id ? { ...prev, shopAddress: e.target.value } : prev
                                )
                              }
                              disabled={updatingUserId === user.id}
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                              disabled={updatingUserId === user.id}
                              onClick={() => {
                                if (!editingUser?.shopName?.trim() || !editingUser?.shopAddress?.trim()) {
                                  setUsersError("Veuillez renseigner le nom et l'adresse de la boutique.");
                                  setUserSuccessMessage('');
                                  return;
                                }
                                handleAccountTypeUpdate(user.id, 'shop', {
                                  shopName: editingUser.shopName.trim(),
                                  shopAddress: editingUser.shopAddress.trim()
                                });
                              }}
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              onClick={() => setEditingUser(null)}
                              disabled={updatingUserId === user.id}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full rounded bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          onClick={() => {
                            setEditingUser({
                              id: user.id,
                              shopName: user.shopName || '',
                              shopAddress: user.shopAddress || ''
                            });
                            setUsersError('');
                            setUserSuccessMessage('');
                          }}
                        >
                          Convertir en boutique
                        </button>
                      )}
                      <div className="border-t border-gray-100 pt-3">
                        {isAdminRole ? (
                          <p className="text-xs text-gray-500">Rôle administrateur non modifiable.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                              Rôle actuel&nbsp;:{' '}
                              {isManagerRole ? 'Gestionnaire de ventes' : 'Utilisateur'}
                            </p>
                            <button
                              type="button"
                              className={`w-full rounded px-3 py-2 text-xs font-semibold ${
                                isManagerRole
                                  ? 'border border-amber-400 text-amber-700 hover:bg-amber-50'
                                  : 'bg-amber-500 text-white hover:bg-amber-600'
                              } disabled:opacity-60`}
                              onClick={() => handleRoleUpdate(user.id, nextRole)}
                              disabled={roleUpdatingId === user.id || isSelf}
                            >
                              {roleUpdatingId === user.id
                                ? 'Mise à jour...'
                                : isManagerRole
                                ? 'Retirer le rôle gestionnaire'
                                : 'Nommer gestionnaire de ventes'}
                            </button>
                            {isSelf ? (
                              <p className="text-[11px] text-gray-500">
                                Vous ne pouvez pas modifier votre propre rôle.
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Aucun utilisateur ne correspond à la recherche actuelle.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border text-left">Nom</th>
                  <th className="p-2 border text-left">Email</th>
                  <th className="p-2 border text-left">Statut</th>
                  <th className="p-2 border text-left">Téléphone</th>
                  <th className="p-2 border text-left">Inscription</th>
                  <th className="p-2 border text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td className="p-3 text-sm text-gray-500" colSpan={6}>
                      Chargement des utilisateurs…
                    </td>
                  </tr>
                ) : paginatedUsers.length ? (
                  paginatedUsers.map((user) => {
                    const isManagerRole = user.role === 'manager';
                    const isAdminRole = user.role === 'admin';
                    const isSelf = authUser?.id === user.id;
                    const nextRole = isManagerRole ? 'user' : 'manager';
                    return (
                      <tr key={user.id} className="align-top">
                        <td className="p-2 border">
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">Rôle&nbsp;: {user.role}</p>
                        </td>
                        <td className="p-2 border">{user.email}</td>
                        <td className="p-2 border">
                          {user.accountType === 'shop' ? (
                            <div className="space-y-2">
                              <span className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                                Boutique
                              </span>
                              <VerifiedBadge verified={Boolean(user.shopVerified)} />
                              {user.shopName ? (
                                <p className="text-xs text-gray-600 truncate">{user.shopName}</p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                              Particulier
                            </span>
                          )}
                        </td>
                        <td className="p-2 border">{user.phone || '—'}</td>
                        <td className="p-2 border">{formatDate(user.createdAt)}</td>
                        <td className="p-2 border">
                          <div className="space-y-3">
                            {user.accountType === 'shop' ? (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                  onClick={() => handleAccountTypeUpdate(user.id, 'person')}
                                  disabled={updatingUserId === user.id}
                                >
                                  Convertir en particulier
                                </button>
                                <button
                                  type="button"
                                  className={`rounded px-3 py-1 text-xs font-medium text-white ${
                                    user.shopVerified
                                      ? 'bg-amber-500 hover:bg-amber-600'
                                      : 'bg-emerald-600 hover:bg-emerald-700'
                                  } disabled:opacity-60`}
                                  onClick={() => toggleShopVerification(user.id, !user.shopVerified)}
                                  disabled={verifyingShopId === user.id}
                                >
                                  {user.shopVerified ? 'Retirer le badge' : 'Vérifier la boutique'}
                                </button>
                              </div>
                            ) : editingUser?.id === user.id ? (
                              <div className="space-y-2">
                                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                                  Nom de la boutique
                                  <input
                                    className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={editingUser.shopName}
                                    onChange={(e) =>
                                      setEditingUser((prev) =>
                                        prev && prev.id === user.id ? { ...prev, shopName: e.target.value } : prev
                                      )
                                    }
                                    disabled={updatingUserId === user.id}
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                                  Adresse de la boutique
                                  <textarea
                                    className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    rows={2}
                                    value={editingUser.shopAddress}
                                    onChange={(e) =>
                                      setEditingUser((prev) =>
                                        prev && prev.id === user.id
                                          ? { ...prev, shopAddress: e.target.value }
                                          : prev
                                      )
                                    }
                                    disabled={updatingUserId === user.id}
                                  />
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="flex-1 rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                    disabled={updatingUserId === user.id}
                                    onClick={() => {
                                      if (!editingUser?.shopName?.trim() || !editingUser?.shopAddress?.trim()) {
                                        setUsersError("Veuillez renseigner le nom et l'adresse de la boutique.");
                                        setUserSuccessMessage('');
                                        return;
                                      }
                                      handleAccountTypeUpdate(user.id, 'shop', {
                                        shopName: editingUser.shopName.trim(),
                                        shopAddress: editingUser.shopAddress.trim()
                                      });
                                    }}
                                  >
                                    Valider
                                  </button>
                                  <button
                                    type="button"
                                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                    onClick={() => setEditingUser(null)}
                                    disabled={updatingUserId === user.id}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="rounded bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                onClick={() => {
                                  setEditingUser({
                                    id: user.id,
                                    shopName: user.shopName || '',
                                    shopAddress: user.shopAddress || ''
                                  });
                                  setUsersError('');
                                  setUserSuccessMessage('');
                                }}
                              >
                                Convertir en boutique
                              </button>
                            )}
                            <div className="border-t border-gray-100 pt-3">
                              {isAdminRole ? (
                                <p className="text-xs text-gray-500">Rôle administrateur non modifiable.</p>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                    Rôle actuel&nbsp;:{' '}
                                    {isManagerRole ? 'Gestionnaire de ventes' : 'Utilisateur'}
                                  </p>
                                  <button
                                    type="button"
                                    className={`rounded px-3 py-1 text-xs font-semibold ${
                                      isManagerRole
                                        ? 'border border-amber-400 text-amber-700 hover:bg-amber-50'
                                        : 'bg-amber-500 text-white hover:bg-amber-600'
                                    } disabled:opacity-60`}
                                    onClick={() => handleRoleUpdate(user.id, nextRole)}
                                    disabled={roleUpdatingId === user.id || isSelf}
                                  >
                                    {roleUpdatingId === user.id
                                      ? 'Mise à jour...'
                                      : isManagerRole
                                      ? 'Retirer le rôle gestionnaire'
                                      : 'Nommer gestionnaire de ventes'}
                                  </button>
                                  {isSelf ? (
                                    <p className="text-[11px] text-gray-500">
                                      Vous ne pouvez pas modifier votre propre rôle.
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-3 text-sm text-gray-500" colSpan={6}>
                      Aucun utilisateur ne correspond à la recherche actuelle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!usersLoading && (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {users.length
                ? `Affichage ${usersRangeStart}-${usersRangeEnd} sur ${users.length} utilisateurs`
                : 'Aucun utilisateur pour ces critères.'}
            </p>
            {users.length ? (
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                  disabled={usersPage <= 1}
                >
                  Précédent
                </button>
                <span className="font-medium text-gray-700">
                  Page {usersPage} / {totalUserPages}
                </span>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setUsersPage((prev) => Math.min(totalUserPages, prev + 1))}
                  disabled={usersPage >= totalUserPages}
                >
                  Suivant
                </button>
              </div>
            ) : null}
          </div>
        )}
        </section>
      )}

      {canManagePayments && shouldShowSection('payments') && (
        <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vérification des paiements</h2>
            <p className="text-xs text-gray-500">
              Validez ou rejetez les preuves de paiement envoyées par les vendeurs.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {isMobileView ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {paymentFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      filter === option.value
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600" htmlFor="admin-payments-filter">
                  Statut&nbsp;:
                </label>
                <select
                  id="admin-payments-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {paymentFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-full sm:w-64">
              <input
                type="search"
                value={paymentSearchDraft}
                onChange={(e) => setPaymentSearchDraft(e.target.value)}
                placeholder="Rechercher un produit…"
                className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
        {paymentActionMessage ? <p className="text-sm text-green-600">{paymentActionMessage}</p> : null}
        {paymentActionError ? <p className="text-sm text-red-600">{paymentActionError}</p> : null}
        {isMobileView ? (
          <div className="space-y-4">
            {paginatedPayments.map((p) => (
              <div key={p._id} className="rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.product?.title || 'Annonce'}</p>
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${
                      paymentStatusStyles[p.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {paymentStatusLabels[p.status] || p.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span>
                    Payeur : <strong className="text-gray-800">{p.payerName}</strong>
                  </span>
                  <span className="hidden xs:inline-block text-gray-400">•</span>
                  <span>
                    Opérateur : <strong className="text-gray-800">{p.operator}</strong>
                  </span>
                  <span className="hidden xs:inline-block text-gray-400">•</span>
                  <span>
                    Montant : <strong className="text-gray-800">{formatCurrency(p.amount)}</strong>
                  </span>
                </div>
                {p.product?.images?.length ? (
                  <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-100 p-2">
                    {p.product.images.slice(0, 4).map((src, idx) => (
                      <a key={src || idx} href={src} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img
                          src={src}
                          alt={`${p.product?.title || 'Produit'} ${idx + 1}`}
                          className="h-16 w-20 rounded-lg border object-cover shadow-sm"
                          loading="lazy"
                        />
                      </a>
                    ))}
                    {p.product.images.length > 4 && (
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        +{p.product.images.length - 4} autres
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Aucune image pour cette annonce.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {p.product?._id && (
                    <Link
                      to={`/product/${p.product._id}`}
                      {...externalLinkProps}
                      className="flex-1 min-w-[140px] rounded-lg border border-indigo-200 px-3 py-2 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Voir l&apos;annonce
                    </Link>
                  )}
                  {p.transactionNumber && (
                    <button
                      type="button"
                      className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={() => copyTransactionNumber(p.transactionNumber)}
                    >
                      Copier la référence
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.product?.status !== 'disabled' && p.product?._id && (
                    <button
                      type="button"
                      className="flex-1 min-w-[140px] rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      onClick={() => disableListing(p.product._id)}
                    >
                      Désactiver l&apos;annonce
                    </button>
                  )}
                  {p.product?.status === 'disabled' && p.product?._id && (
                    <button
                      type="button"
                      className="flex-1 min-w-[140px] rounded-lg border border-green-300 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                      onClick={() => enableListing(p.product._id)}
                    >
                      Activer l&apos;annonce
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.status === 'waiting' ? (
                    <>
                      <button
                        onClick={() => actOnPayment(p._id, 'verify')}
                        className="flex-1 min-w-[140px] rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => actOnPayment(p._id, 'reject')}
                        className="flex-1 min-w-[140px] rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Refuser
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">Action non disponible pour ce paiement.</span>
                  )}
                </div>
              </div>
            ))}
            {!payments.length && (
              <p className="text-sm text-gray-500">Aucun paiement ne correspond à la recherche actuelle.</p>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Image</th>
                <th className="p-2 border">Annonce</th>
                <th className="p-2 border">Prix</th>
                <th className="p-2 border">Payeur</th>
                <th className="p-2 border">Opérateur</th>
                <th className="p-2 border">Montant</th>
                <th className="p-2 border">Statut</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments.map((p) => (
                <tr key={p._id}>
                  <td className="p-2 border align-top">
                    {p.product?.images?.length ? (
                      <div className="flex items-center gap-2 max-w-[220px] overflow-x-auto">
                        {p.product.images.slice(0, 3).map((src, idx) => (
                          <a
                            key={src || idx}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                            title="Ouvrir l'image dans un nouvel onglet"
                          >
                            <img
                              src={src}
                              alt={`${p.product?.title || 'Produit'} ${idx + 1}`}
                              className="h-16 w-20 object-cover rounded border shadow-sm"
                              loading="lazy"
                            />
                          </a>
                        ))}
                        {p.product.images.length > 3 && (
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            +{p.product.images.length - 3} autres
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Aucune image</span>
                    )}
                  </td>
                  <td className="p-2 border">{p.product?.title}</td>
                  <td className="p-2 border">{formatCurrency(p.product?.price)}</td>
                  <td className="p-2 border">{p.payerName}</td>
                  <td className="p-2 border">{p.operator}</td>
                  <td className="p-2 border">{formatCurrency(p.amount)}</td>
                  <td className="p-2 border">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                        paymentStatusStyles[p.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {paymentStatusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="p-2 border">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {p.product?._id ? (
                        <Link
                          to={`/product/${p.product._id}`}
                          {...externalLinkProps}
                          className="rounded border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Voir l&apos;annonce
                        </Link>
                      ) : null}
                      {p.transactionNumber ? (
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          onClick={() => copyTransactionNumber(p.transactionNumber)}
                        >
                          Copier la référence
                        </button>
                      ) : null}
                      {p.product?.status !== 'disabled' && p.product?._id ? (
                        <button
                          type="button"
                          className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          onClick={() => disableListing(p.product._id)}
                        >
                          Désactiver
                        </button>
                      ) : null}
                      {p.product?.status === 'disabled' && p.product?._id ? (
                        <button
                          type="button"
                          className="rounded border border-green-300 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                          onClick={() => enableListing(p.product._id)}
                        >
                          Activer
                        </button>
                      ) : null}
                      {p.status === 'waiting' ? (
                        <>
                          <button
                            onClick={() => actOnPayment(p._id, 'verify')}
                            className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => actOnPayment(p._id, 'reject')}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Refuser
                          </button>
                        </>
                      ) : (
                        <span className="self-center text-xs text-gray-500">Action non disponible</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td className="p-4 text-sm text-gray-500" colSpan={8}>
                    Aucun paiement à afficher pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {payments.length
              ? `Affichage ${paymentsRangeStart}-${paymentsRangeEnd} sur ${payments.length} paiements`
              : 'Aucun paiement à afficher.'}
          </p>
          {payments.length ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPaymentsPage((prev) => Math.max(1, prev - 1))}
                disabled={paymentsPage <= 1}
              >
                Précédent
              </button>
              <span className="font-medium text-gray-700">
                Page {paymentsPage} / {totalPaymentPages}
              </span>
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPaymentsPage((prev) => Math.min(totalPaymentPages, prev + 1))}
                disabled={paymentsPage >= totalPaymentPages}
              >
                Suivant
              </button>
            </div>
          ) : null}
        </div>
        </>
        )}
        </section>
      )}
      </div>
    </div>
  );
}
