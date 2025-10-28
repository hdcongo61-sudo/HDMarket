import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

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
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userSearchValue, setUserSearchValue] = useState('');
  const [userAccountFilter, setUserAccountFilter] = useState('person');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userSuccessMessage, setUserSuccessMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [paymentActionMessage, setPaymentActionMessage] = useState('');
  const [paymentActionError, setPaymentActionError] = useState('');

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
    let url = '/payments/admin';
    if (['waiting', 'verified', 'rejected'].includes(filter)) {
      url += `?status=${filter}`;
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

    setPayments(normalized);
  }, [filter, normalizeUrl]);

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
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const actOnPayment = useCallback(
    async (id, type) => {
      try {
        setPaymentActionMessage('');
        setPaymentActionError('');
        if (type === 'verify') await api.put(`/payments/admin/${id}/verify`);
        else await api.put(`/payments/admin/${id}/reject`);
        await loadPayments();
        await loadStats();
        setPaymentActionMessage(
          type === 'verify' ? 'Paiement validé avec succès.' : 'Paiement rejeté avec succès.'
        );
      } catch (e) {
        setPaymentActionError(e.response?.data?.message || e.message || 'Action impossible.');
      }
    },
    [loadPayments, loadStats]
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
        await loadStats();
        setPaymentActionMessage('Annonce désactivée avec succès.');
      } catch (e) {
        setPaymentActionError(
          e.response?.data?.message || e.message || 'Impossible de désactiver cette annonce.'
        );
      }
    },
    [loadPayments, loadStats]
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
        await loadStats();
        setPaymentActionMessage('Annonce réactivée avec succès.');
      } catch (e) {
        setPaymentActionError(
          e.response?.data?.message || e.message || 'Impossible de réactiver cette annonce.'
        );
      }
    },
    [loadPayments, loadStats]
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

  const refreshAll = useCallback(() => {
    loadStats();
    loadPayments();
    loadUsers();
  }, [loadStats, loadPayments, loadUsers]);

  useEffect(() => {
    if (!paymentActionMessage && !paymentActionError) return;
    const timer = setTimeout(() => {
      setPaymentActionMessage('');
      setPaymentActionError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [paymentActionMessage, paymentActionError]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord administrateur</h1>
          <p className="text-sm text-gray-500">
            Visualisez les indicateurs clés de la plateforme et gérez la validation des paiements.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center justify-center rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Actualiser
        </button>
      </header>

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
          <h3 className="text-base font-semibold text-gray-900">Paiements récents</h3>
          <p className="text-xs text-gray-500 mb-3">5 derniers paiements reçus.</p>
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
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">Aucun paiement récent.</li>
            )}
          </ul>
        </div>
      </section>

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
              setUserSearchValue(userSearchDraft.trim());
            }}
          >
            <input
              type="search"
              className="w-full rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-60"
              placeholder="Nom, email ou téléphone"
              value={userSearchDraft}
              onChange={(e) => setUserSearchDraft(e.target.value)}
            />
            <div className="flex gap-2">
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
                <option value="person">Particuliers</option>
                <option value="shop">Boutiques</option>
                <option value="all">Tous</option>
              </select>
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
          </form>
        </div>
        {usersError ? <p className="text-sm text-red-600">{usersError}</p> : null}
        {userSuccessMessage ? <p className="text-sm text-green-600">{userSuccessMessage}</p> : null}
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
              ) : users.length ? (
                users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="p-2 border">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">Rôle&nbsp;: {user.role}</p>
                    </td>
                    <td className="p-2 border">{user.email}</td>
                    <td className="p-2 border">
                      {user.accountType === 'shop' ? (
                        <span className="inline-flex items-center rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                          Boutique
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          Particulier
                        </span>
                      )}
                    </td>
                    <td className="p-2 border">{user.phone || '—'}</td>
                    <td className="p-2 border">{formatDate(user.createdAt)}</td>
                    <td className="p-2 border">
                      {user.accountType === 'shop' ? (
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          onClick={() => handleAccountTypeUpdate(user.id, 'person')}
                          disabled={updatingUserId === user.id}
                        >
                          Convertir en particulier
                        </button>
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
                    </td>
                  </tr>
                ))
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
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vérification des paiements</h2>
            <p className="text-xs text-gray-500">
              Validez ou rejetez les preuves de paiement envoyées par les vendeurs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="admin-payments-filter">
              Filtrer&nbsp;:
            </label>
            <select
              id="admin-payments-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="waiting">En attente</option>
              <option value="verified">Validés</option>
              <option value="rejected">Rejetés</option>
              <option value="disabled_products">Annonces désactivées</option>
            </select>
          </div>
        </div>
        {paymentActionMessage ? <p className="text-sm text-green-600">{paymentActionMessage}</p> : null}
        {paymentActionError ? <p className="text-sm text-red-600">{paymentActionError}</p> : null}
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
              {payments.map((p) => (
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
                        <a
                          href={`/product/${p.product._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Voir l&apos;annonce
                        </a>
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
      </section>
    </div>
  );
}
