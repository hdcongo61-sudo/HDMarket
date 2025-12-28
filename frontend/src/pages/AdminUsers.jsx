import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import api from '../services/api';
import useIsMobile from '../hooks/useIsMobile';

const accountTypeLabels = {
  person: 'Particulier',
  shop: 'Boutique'
};

const roleLabels = {
  user: 'Utilisateur',
  admin: 'Administrateur'
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const USERS_PER_PAGE = 15;
const accountFilterOptions = [
  { value: 'all', label: 'Tous les types' },
  { value: 'person', label: 'Particuliers' },
  { value: 'shop', label: 'Boutiques' }
];
const statusFilterOptions = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'blocked', label: 'Suspendus' }
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobileView = useIsMobile(1023);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const params = { limit: 100 };
        if (searchTerm) params.search = searchTerm;
        if (accountTypeFilter !== 'all') params.accountType = accountTypeFilter;
        const { data } = await api.get('/admin/users', {
          params,
          signal: controller.signal
        });
        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!isMounted || e.name === 'CanceledError' || e.name === 'AbortError') return;
        setError(
          e.response?.data?.message ||
            e.message ||
            'Impossible de charger la liste des utilisateurs.'
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [accountTypeFilter, searchTerm, refreshKey]);

  const displayedUsers = useMemo(() => {
    if (statusFilter === 'blocked') {
      return users.filter((user) => user.isBlocked);
    }
    if (statusFilter === 'active') {
      return users.filter((user) => !user.isBlocked);
    }
    return users;
  }, [statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const blocked = users.filter((user) => user.isBlocked).length;
    const shops = users.filter((user) => user.accountType === 'shop').length;
    return {
      total,
      blocked,
      shops
    };
  }, [users]);

  useEffect(() => {
    setPage(1);
  }, [accountTypeFilter, statusFilter, searchTerm]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(displayedUsers.length / USERS_PER_PAGE));
    setPage((prev) => Math.min(prev, totalPages));
  }, [displayedUsers.length]);

  const totalPages = Math.max(1, Math.ceil(displayedUsers.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * USERS_PER_PAGE;
    return displayedUsers.slice(start, start + USERS_PER_PAGE);
  }, [displayedUsers, page]);
  const rangeStart = displayedUsers.length ? (page - 1) * USERS_PER_PAGE + 1 : 0;
  const rangeEnd = displayedUsers.length ? Math.min(page * USERS_PER_PAGE, displayedUsers.length) : 0;

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  const upsertUser = (nextUser) => {
    setUsers((prev) => {
      const exists = prev.some((user) => user.id === nextUser.id);
      if (exists) {
        return prev.map((user) => (user.id === nextUser.id ? nextUser : user));
      }
      return [nextUser, ...prev];
    });
  };

  const handleBlock = async (user) => {
    const defaultReason = user.blockedReason || '';
    const reason = window.prompt(
      'Raison de la suspension (facultatif, visible uniquement par les administrateurs) :',
      defaultReason
    );
    if (reason === null) return;
    setActionError('');
    setPendingUserId(user.id);
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/block`, { reason: reason || '' });
      upsertUser(data);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de suspendre cet utilisateur pour le moment.'
      );
    } finally {
      setPendingUserId('');
    }
  };

  const handleUnblock = async (user) => {
    setActionError('');
    setPendingUserId(user.id);
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/unblock`);
      upsertUser(data);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de rétablir cet utilisateur pour le moment.'
      );
    } finally {
      setPendingUserId('');
    }
  };

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500">
            Administrez les comptes, suspendez ou réactivez un utilisateur en cas d&apos;abuse.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <ArrowLeft size={16} />
            Retour au tableau de bord
          </Link>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Utilisateurs totaux</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Boutiques enregistrées</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.shops}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Utilisateurs bloqués</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.blocked}</p>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
        >
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Rechercher un nom, email ou téléphone"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
              >
                Rechercher
              </button>
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
          {isMobileView ? (
            <div className="space-y-3">
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {accountFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccountTypeFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      accountTypeFilter === option.value
                        ? 'bg-indigo-600 text-white shadow'
                        : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      statusFilter === option.value
                        ? 'bg-gray-900 text-white shadow'
                        : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {accountFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        {isMobileView ? (
          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500">Chargement des utilisateurs…</p>
            ) : paginatedUsers.length ? (
              paginatedUsers.map((user) => {
                const isBlocked = Boolean(user.isBlocked);
                return (
                  <article key={user.id} className="space-y-3 rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500 break-all">{user.email}</p>
                        <p className="text-xs text-gray-400">{user.phone || '—'}</p>
                        {user.accountType === 'shop' && user.shopName ? (
                          <p className="text-xs font-semibold text-indigo-600">Boutique : {user.shopName}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                        {accountTypeLabels[user.accountType] || user.accountType}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                        {roleLabels[user.role] || user.role}
                      </span>
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">
                          <Ban size={12} />
                          Suspendu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-600">
                          <CheckCircle2 size={12} />
                          Actif
                        </span>
                      )}
                    </div>
                    {isBlocked ? (
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Depuis le {formatDate(user.blockedAt)}</p>
                        {user.blockedReason ? <p className="italic">Motif : {user.blockedReason}</p> : null}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {isBlocked ? (
                        <button
                          type="button"
                          onClick={() => handleUnblock(user)}
                          disabled={pendingUserId === user.id}
                          className="flex-1 min-w-[140px] rounded-lg border border-green-500 px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          Réactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBlock(user)}
                          disabled={pendingUserId === user.id}
                          className="flex-1 min-w-[140px] rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Suspendre
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">Aucun utilisateur à afficher.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Utilisateur</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Rôle</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Statut</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Chargement des utilisateurs…
                    </td>
                  </tr>
                ) : displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Aucun utilisateur à afficher.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const isBlocked = Boolean(user.isBlocked);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{user.name}</span>
                            <span className="text-gray-500">{user.email}</span>
                            <span className="text-gray-400 text-xs">{user.phone}</span>
                            {user.accountType === 'shop' && user.shopName ? (
                              <span className="text-indigo-600 text-xs font-semibold mt-1">
                                Boutique : {user.shopName}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            {accountTypeLabels[user.accountType] || user.accountType}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-sm text-gray-700">
                            {roleLabels[user.role] || user.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {isBlocked ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                                <Ban size={12} />
                                Suspendu
                              </span>
                              <span className="text-xs text-gray-500">
                                Depuis le {formatDate(user.blockedAt)}
                              </span>
                              {user.blockedReason ? (
                                <span className="text-xs text-gray-500 italic">
                                  Motif : {user.blockedReason}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                              <CheckCircle2 size={12} />
                              Actif
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {isBlocked ? (
                            <button
                              type="button"
                              onClick={() => handleUnblock(user)}
                              disabled={pendingUserId === user.id}
                              className="rounded-lg border border-green-500 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                            >
                              Réactiver
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleBlock(user)}
                              disabled={pendingUserId === user.id}
                              className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Suspendre
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {displayedUsers.length > 0 && !loading ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Affichage {rangeStart}-{rangeEnd} sur {displayedUsers.length} utilisateurs
            </p>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Précédent
              </button>
              <span className="font-medium text-gray-700">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Suivant
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
