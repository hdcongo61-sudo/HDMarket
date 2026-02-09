import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, RefreshCw, Search, ShieldAlert, MessageSquareOff, ShoppingCartIcon, HeartOff, ImageOff, X, Calendar, ChevronDown, Package, EyeOff, History, Store, CheckCircle, XCircle, DollarSign, Hash, CreditCard, FileImage, User, AlertCircle } from 'lucide-react';
import { buildShopPath } from '../utils/links';
import api from '../services/api';
import useIsMobile from '../hooks/useIsMobile';

const RESTRICTION_TYPES = [
  { key: 'canComment', label: 'Commentaires', icon: MessageSquareOff, color: 'orange', shopOnly: false },
  { key: 'canOrder', label: 'Commandes', icon: ShoppingCartIcon, color: 'red', shopOnly: false },
  { key: 'canMessage', label: 'Messages', icon: MessageSquareOff, color: 'purple', shopOnly: false },
  { key: 'canAddFavorites', label: 'Favoris', icon: HeartOff, color: 'pink', shopOnly: false },
  { key: 'canUploadImages', label: 'Images', icon: ImageOff, color: 'blue', shopOnly: false },
  { key: 'canBeViewed', label: 'Visibilité boutique', icon: EyeOff, color: 'gray', shopOnly: true }
];

const accountTypeLabels = {
  person: 'Particulier',
  shop: 'Boutique'
};

const roleLabels = {
  user: 'Utilisateur',
  admin: 'Administrateur'
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('fr-FR');
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
const restrictionFilterOptions = [
  { value: 'all', label: 'Toutes restrictions' },
  { value: 'any_active', label: 'Avec restriction(s)' },
  { value: 'none', label: 'Sans restriction' },
  { value: 'canComment', label: 'Commentaires' },
  { value: 'canOrder', label: 'Commandes' },
  { value: 'canMessage', label: 'Messages' },
  { value: 'canAddFavorites', label: 'Favoris' },
  { value: 'canUploadImages', label: 'Images' },
  { value: 'canBeViewed', label: 'Visibilité' }
];
const conversionFilterOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'pending_conversion', label: 'Demande boutique en attente' }
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
  const [restrictionFilter, setRestrictionFilter] = useState('all');
  const [conversionFilter, setConversionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobileView = useIsMobile(1023);

  // Restriction modal state
  const [restrictionModal, setRestrictionModal] = useState({ open: false, user: null });
  const [restrictionMenuOpen, setRestrictionMenuOpen] = useState(null);
  const [restrictionLoading, setRestrictionLoading] = useState(false);
  const [restrictionForm, setRestrictionForm] = useState({
    type: '',
    restricted: false,
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Received orders modal state
  const [ordersModal, setOrdersModal] = useState({ open: false, user: null });
  const [receivedOrders, setReceivedOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(0);

  // Audit log modal state
  const [auditModal, setAuditModal] = useState({ open: false, user: null });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(0);

  // Shop conversion request modal state
  const [conversionModal, setConversionModal] = useState({ open: false, user: null, request: null });
  const [conversionRequests, setConversionRequests] = useState([]);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [convertingUserId, setConvertingUserId] = useState('');

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

  // Load shop conversion requests
  useEffect(() => {
    const loadConversionRequests = async () => {
      try {
        const { data } = await api.get('/admin/shop-conversion-requests?status=pending');
        setConversionRequests(data || []);
      } catch (err) {
        console.error('Error loading conversion requests:', err);
      }
    };
    loadConversionRequests();
  }, [refreshKey]);

  const displayedUsers = useMemo(() => {
    let filtered = users;

    // Status filter
    if (statusFilter === 'blocked') {
      filtered = filtered.filter((user) => user.isBlocked);
    } else if (statusFilter === 'active') {
      filtered = filtered.filter((user) => !user.isBlocked);
    }

    // Restriction filter
    if (restrictionFilter === 'any_active') {
      filtered = filtered.filter((user) =>
        RESTRICTION_TYPES.some((rt) => user.restrictions?.[rt.key]?.isActive)
      );
    } else if (restrictionFilter === 'none') {
      filtered = filtered.filter((user) =>
        !RESTRICTION_TYPES.some((rt) => user.restrictions?.[rt.key]?.isActive)
      );
    } else if (restrictionFilter !== 'all') {
      // Filter by specific restriction type
      filtered = filtered.filter((user) => user.restrictions?.[restrictionFilter]?.isActive);
    }

    // Conversion filter: users with pending shop conversion request
    if (conversionFilter === 'pending_conversion') {
      const pendingUserIds = new Set(
        (conversionRequests || []).map((r) => (r.user?._id || r.user)?.toString()).filter(Boolean)
      );
      filtered = filtered.filter((user) => pendingUserIds.has(user.id));
    }

    return filtered;
  }, [statusFilter, restrictionFilter, conversionFilter, users, conversionRequests]);

  const stats = useMemo(() => {
    const total = users.length;
    const blocked = users.filter((user) => user.isBlocked).length;
    const shops = users.filter((user) => user.accountType === 'shop').length;
    const restricted = users.filter((user) =>
      RESTRICTION_TYPES.some((rt) => user.restrictions?.[rt.key]?.isActive)
    ).length;
    const pendingConversion = conversionRequests.length;
    return {
      total,
      blocked,
      shops,
      restricted,
      pendingConversion
    };
  }, [users, conversionRequests]);

  useEffect(() => {
    setPage(1);
  }, [accountTypeFilter, statusFilter, restrictionFilter, conversionFilter, searchTerm]);

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

  const openConversionModal = (user) => {
    const request = conversionRequests.find((r) => r.user?._id === user.id || r.user === user.id);
    setConversionModal({ open: true, user, request });
  };

  const closeConversionModal = () => {
    setConversionModal({ open: false, user: null, request: null });
  };

  const handleApproveConversion = async (requestId) => {
    setConversionLoading(true);
    setActionError('');
    try {
      await api.patch(`/admin/shop-conversion-requests/${requestId}/approve`);
      setConversionRequests((prev) => prev.filter((r) => r._id !== requestId));
      closeConversionModal();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible d\'approuver la demande pour le moment.'
      );
    } finally {
      setConversionLoading(false);
    }
  };

  const handleRejectConversion = async (requestId) => {
    const reason = window.prompt('Raison du rejet (facultatif) :', '');
    if (reason === null) return;
    setConversionLoading(true);
    setActionError('');
    try {
      await api.patch(`/admin/shop-conversion-requests/${requestId}/reject`, {
        rejectionReason: reason || ''
      });
      setConversionRequests((prev) => prev.filter((r) => r._id !== requestId));
      closeConversionModal();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de rejeter la demande pour le moment.'
      );
    } finally {
      setConversionLoading(false);
    }
  };

  const handleConvertToShop = async (user) => {
    const shopName = window.prompt('Nom de la boutique :', user.shopName || '');
    if (shopName === null) return;
    if (!shopName.trim()) {
      setActionError('Le nom de la boutique est requis.');
      return;
    }
    const shopAddress = window.prompt('Adresse de la boutique :', user.shopAddress || '');
    if (shopAddress === null) return;
    if (!shopAddress.trim()) {
      setActionError("L'adresse de la boutique est requise.");
      return;
    }
    setConvertingUserId(user.id);
    setActionError('');
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/account-type`, {
        accountType: 'shop',
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        reason: `Conversion manuelle en boutique par l'administrateur`
      });
      upsertUser(data);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de convertir le compte en boutique pour le moment.'
      );
    } finally {
      setConvertingUserId('');
    }
  };

  const handleConvertToParticulier = async (user) => {
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir reconvertir "${user.name}" (${user.shopName || 'Boutique'}) en compte particulier ?\n\nCette action supprimera les informations de la boutique.`
    );
    if (!confirmed) return;
    setConvertingUserId(user.id);
    setActionError('');
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/account-type`, {
        accountType: 'person',
        reason: `Reconversion en particulier par l'administrateur`
      });
      upsertUser(data);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de reconvertir le compte en particulier pour le moment.'
      );
    } finally {
      setConvertingUserId('');
    }
  };

  const getUserConversionRequest = (userId) => {
    return conversionRequests.find((r) => r.user?._id === userId || r.user === userId);
  };

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1);
  };

  // Restriction handlers
  const openRestrictionModal = useCallback((user, restrictionType) => {
    const currentRestriction = user.restrictions?.[restrictionType] || {};
    setRestrictionForm({
      type: restrictionType,
      restricted: currentRestriction.restricted || false,
      startDate: currentRestriction.startDate ? new Date(currentRestriction.startDate).toISOString().slice(0, 16) : '',
      endDate: currentRestriction.endDate ? new Date(currentRestriction.endDate).toISOString().slice(0, 16) : '',
      reason: currentRestriction.reason || ''
    });
    setActionError('');
    setRestrictionModal({ open: true, user });
    setRestrictionMenuOpen(null);
  }, []);

  const closeRestrictionModal = useCallback(() => {
    setRestrictionModal({ open: false, user: null });
    setRestrictionForm({ type: '', restricted: false, startDate: '', endDate: '', reason: '' });
  }, []);

  const handleApplyRestriction = async () => {
    if (!restrictionModal.user || !restrictionForm.type) return;
    setRestrictionLoading(true);
    setActionError('');
    try {
      await api.patch(`/admin/users/${restrictionModal.user.id}/restrictions/${restrictionForm.type}`, {
        restricted: restrictionForm.restricted,
        startDate: restrictionForm.startDate || null,
        endDate: restrictionForm.endDate || null,
        reason: restrictionForm.reason
      });
      // Refresh user data
      const { data } = await api.get('/admin/users', { params: { limit: 100, search: searchTerm || undefined, accountType: accountTypeFilter !== 'all' ? accountTypeFilter : undefined } });
      setUsers(Array.isArray(data) ? data : []);
      closeRestrictionModal();
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Erreur lors de l\'application de la restriction.');
    } finally {
      setRestrictionLoading(false);
    }
  };

  const handleRemoveRestriction = async (userId, restrictionType) => {
    setRestrictionLoading(true);
    setActionError('');
    try {
      await api.delete(`/admin/users/${userId}/restrictions/${restrictionType}`);
      const { data } = await api.get('/admin/users', { params: { limit: 100, search: searchTerm || undefined, accountType: accountTypeFilter !== 'all' ? accountTypeFilter : undefined } });
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Erreur lors de la suppression de la restriction.');
    } finally {
      setRestrictionLoading(false);
    }
  };

  // Received orders handlers
  const openOrdersModal = useCallback(async (user) => {
    setOrdersModal({ open: true, user });
    setOrdersLoading(true);
    setOrdersPage(1);
    try {
      const { data } = await api.get(`/admin/users/${user.id}/received-orders`, { params: { page: 1, limit: 10 } });
      setReceivedOrders(data.orders || []);
      setOrdersTotalPages(data.totalPages || 0);
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement des commandes.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const closeOrdersModal = useCallback(() => {
    setOrdersModal({ open: false, user: null });
    setReceivedOrders([]);
  }, []);

  const loadOrdersPage = async (newPage) => {
    if (!ordersModal.user) return;
    setOrdersLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${ordersModal.user.id}/received-orders`, { params: { page: newPage, limit: 10 } });
      setReceivedOrders(data.orders || []);
      setOrdersPage(newPage);
      setOrdersTotalPages(data.totalPages || 0);
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement des commandes.');
    } finally {
      setOrdersLoading(false);
    }
  };

  // Audit log handlers
  const openAuditModal = useCallback(async (user) => {
    setAuditModal({ open: true, user });
    setAuditLoading(true);
    setAuditPage(1);
    try {
      const { data } = await api.get(`/admin/users/${user.id}/audit-logs`, { params: { page: 1, limit: 10 } });
      setAuditLogs(data.logs || []);
      setAuditTotalPages(data.totalPages || 0);
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement de l\'historique.');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const closeAuditModal = useCallback(() => {
    setAuditModal({ open: false, user: null });
    setAuditLogs([]);
  }, []);

  const loadAuditPage = async (newPage) => {
    if (!auditModal.user) return;
    setAuditLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${auditModal.user.id}/audit-logs`, { params: { page: newPage, limit: 10 } });
      setAuditLogs(data.logs || []);
      setAuditPage(newPage);
      setAuditTotalPages(data.totalPages || 0);
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement de l\'historique.');
    } finally {
      setAuditLoading(false);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      restriction_applied: 'Restriction appliquée',
      restriction_removed: 'Restriction levée',
      user_blocked: 'Compte suspendu',
      user_unblocked: 'Compte réactivé',
      shop_verified: 'Boutique vérifiée',
      shop_unverified: 'Vérification retirée',
      role_changed: 'Rôle modifié',
      account_type_changed: 'Type de compte modifié',
      account_type_changed_to_shop: 'Converti en boutique',
      account_type_changed_to_person: 'Reconverti en particulier'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('blocked') || action.includes('applied') || action === 'shop_unverified') {
      return 'bg-red-100 text-red-700';
    }
    if (action.includes('unblocked') || action.includes('removed') || action === 'shop_verified') {
      return 'bg-green-100 text-green-700';
    }
    if (action.includes('account_type_changed')) {
      return 'bg-purple-100 text-purple-700';
    }
    return 'bg-blue-100 text-blue-700';
  };

  // Get active restrictions count for a user
  const getActiveRestrictionsCount = (user) => {
    if (!user.restrictions) return 0;
    return RESTRICTION_TYPES.filter((rt) => user.restrictions[rt.key]?.isActive).length;
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

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Utilisateurs totaux</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Boutiques</p>
          <p className="text-2xl font-semibold text-gray-900">{stats.shops}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Bloqués</p>
          <p className="text-2xl font-semibold text-red-600">{stats.blocked}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avec restrictions</p>
          <p className="text-2xl font-semibold text-amber-600">{stats.restricted}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Demandes boutique</p>
          <p className="text-2xl font-semibold text-teal-600">{stats.pendingConversion}</p>
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
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {restrictionFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRestrictionFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      restrictionFilter === option.value
                        ? 'bg-amber-500 text-white shadow'
                        : 'border border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {conversionFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setConversionFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      conversionFilter === option.value
                        ? 'bg-teal-600 text-white shadow'
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
              <select
                value={restrictionFilter}
                onChange={(e) => setRestrictionFilter(e.target.value)}
                className={`rounded-lg border px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  restrictionFilter !== 'all' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-700'
                }`}
              >
                {restrictionFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={conversionFilter}
                onChange={(e) => setConversionFilter(e.target.value)}
                className={`rounded-lg border px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                  conversionFilter !== 'all' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700'
                }`}
              >
                {conversionFilterOptions.map((option) => (
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
                          <div className="text-xs space-y-1">
                            <p className="font-semibold text-indigo-600">Boutique : {user.shopName}</p>
                            <p className="text-gray-500">Abonnés : {formatNumber(user.followersCount)}</p>
                          </div>
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
                    {/* Active restrictions badges */}
                    {getActiveRestrictionsCount(user) > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {RESTRICTION_TYPES.filter((rt) => user.restrictions?.[rt.key]?.isActive).map((rt) => {
                          const IconComponent = rt.icon;
                          return (
                            <span key={rt.key} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <IconComponent size={10} />
                              {rt.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {isBlocked ? (
                        <button
                          type="button"
                          onClick={() => handleUnblock(user)}
                          disabled={pendingUserId === user.id}
                          className="flex-1 min-w-[100px] rounded-lg border border-green-500 px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          Réactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBlock(user)}
                          disabled={pendingUserId === user.id}
                          className="flex-1 min-w-[100px] rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Suspendre
                        </button>
                      )}
                      {/* Restrictions dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRestrictionMenuOpen(restrictionMenuOpen === user.id ? null : user.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-50"
                        >
                          <ShieldAlert size={14} />
                          Restrictions
                          <ChevronDown size={12} />
                        </button>
                        {restrictionMenuOpen === user.id && (
                          <div className="absolute right-0 mt-1 w-48 rounded-lg border bg-white shadow-lg z-20">
                            {RESTRICTION_TYPES.filter((rt) => !rt.shopOnly || user.accountType === 'shop').map((rt) => {
                              const isActive = user.restrictions?.[rt.key]?.isActive;
                              const IconComponent = rt.icon;
                              return (
                                <button
                                  key={rt.key}
                                  type="button"
                                  onClick={() => openRestrictionModal(user, rt.key)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                                >
                                  <IconComponent size={14} className={isActive ? 'text-red-500' : 'text-gray-400'} />
                                  <span className={isActive ? 'text-red-600 font-semibold' : 'text-gray-700'}>{rt.label}</span>
                                  {isActive && <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Actif</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Conversion request button */}
                      {user.accountType !== 'shop' && getUserConversionRequest(user.id) && (
                        <button
                          type="button"
                          onClick={() => openConversionModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-500 px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 bg-purple-50"
                        >
                          <Store size={14} />
                          Demande boutique
                        </button>
                      )}
                      {/* Convert to shop button for particulier */}
                      {user.accountType !== 'shop' && !getUserConversionRequest(user.id) && (
                        <button
                          type="button"
                          onClick={() => handleConvertToShop(user)}
                          disabled={convertingUserId === user.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-500 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                        >
                          <Store size={14} />
                          Convertir en boutique
                        </button>
                      )}
                      {/* Received orders button for shops */}
                      {user.accountType === 'shop' && (
                        <button
                          type="button"
                          onClick={() => openOrdersModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-500 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          <Package size={14} />
                          Commandes
                        </button>
                      )}
                      {/* Audit log button */}
                      <button
                        type="button"
                        onClick={() => openAuditModal(user)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        <History size={14} />
                        Historique
                      </button>
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
                              <div className="text-xs text-gray-500 mt-1 space-y-1">
                                <span className="text-indigo-600 font-semibold">
                                  Boutique : {user.shopName}
                                </span>
                                <p>Abonnés : {formatNumber(user.followersCount)}</p>
                                <Link
                                  to={buildShopPath(user)}
                                  className="text-indigo-500 underline text-xs font-semibold"
                                >
                                  Voir la boutique
                                </Link>
                              </div>
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
                          <div className="flex flex-wrap items-center gap-2">
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
                            {/* Conversion request button */}
                            {user.accountType !== 'shop' && getUserConversionRequest(user.id) && (
                              <button
                                type="button"
                                onClick={() => openConversionModal(user)}
                                className="rounded-lg border border-purple-500 px-3 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 bg-purple-50"
                              >
                                <Store size={14} className="inline mr-1" />
                                Demande boutique
                              </button>
                            )}
                            {/* Convert to shop button for particulier */}
                            {user.accountType !== 'shop' && !getUserConversionRequest(user.id) && (
                              <button
                                type="button"
                                onClick={() => handleConvertToShop(user)}
                                disabled={convertingUserId === user.id}
                                className="rounded-lg border border-teal-500 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                              >
                                <Store size={14} className="inline mr-1" />
                                Convertir
                              </button>
                            )}
                            {/* Reconvert to particulier button for shops */}
                            {user.accountType === 'shop' && (
                              <button
                                type="button"
                                onClick={() => handleConvertToParticulier(user)}
                                disabled={convertingUserId === user.id}
                                className="rounded-lg border border-orange-500 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                              >
                                <User size={14} className="inline mr-1" />
                                Reconvertir
                              </button>
                            )}
                            {/* Restrictions dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setRestrictionMenuOpen(restrictionMenuOpen === user.id ? null : user.id)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold hover:bg-amber-50 ${
                                  getActiveRestrictionsCount(user) > 0 ? 'border-amber-500 text-amber-600 bg-amber-50' : 'border-gray-300 text-gray-600'
                                }`}
                              >
                                <ShieldAlert size={12} />
                                {getActiveRestrictionsCount(user) > 0 && <span>{getActiveRestrictionsCount(user)}</span>}
                                <ChevronDown size={10} />
                              </button>
                              {restrictionMenuOpen === user.id && (
                                <div className="absolute right-0 mt-1 w-52 rounded-lg border bg-white shadow-lg z-20">
                                  <div className="px-3 py-2 border-b text-xs font-semibold text-gray-500">Restrictions</div>
                                  {RESTRICTION_TYPES.filter((rt) => !rt.shopOnly || user.accountType === 'shop').map((rt) => {
                                    const isActive = user.restrictions?.[rt.key]?.isActive;
                                    const IconComponent = rt.icon;
                                    return (
                                      <button
                                        key={rt.key}
                                        type="button"
                                        onClick={() => openRestrictionModal(user, rt.key)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50"
                                      >
                                        <IconComponent size={14} className={isActive ? 'text-red-500' : 'text-gray-400'} />
                                        <span className={isActive ? 'text-red-600 font-semibold' : 'text-gray-700'}>{rt.label}</span>
                                        {isActive && <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Actif</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {/* Received orders button for shops */}
                            {user.accountType === 'shop' && (
                              <button
                                type="button"
                                onClick={() => openOrdersModal(user)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-400 px-2 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                                title="Commandes reçues"
                              >
                                <Package size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openAuditModal(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                              title="Historique des actions"
                            >
                              <History size={12} />
                            </button>
                            <Link
                              to={`/admin/users/${user.id}/stats`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                              title="Statistiques"
                            >
                              Stats
                            </Link>
                          </div>
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

      {/* Restriction Modal */}
      {restrictionModal.open && restrictionModal.user && (() => {
        const restrictionType = RESTRICTION_TYPES.find((rt) => rt.key === restrictionForm.type);
        const IconComponent = restrictionType?.icon || ShieldAlert;
        const isActive = restrictionForm.restricted;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeRestrictionModal}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${isActive ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <IconComponent size={24} className={isActive ? 'text-red-600' : 'text-gray-500'} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 mb-1">
                        {restrictionType?.label || 'Restriction'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {restrictionModal.user.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {restrictionModal.user.email}
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={closeRestrictionModal} 
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status Toggle */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border-2 border-dashed border-gray-200">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                        isActive ? 'bg-red-500' : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${
                          isActive ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </div>
                      <div>
                        <span className={`text-base font-bold block ${isActive ? 'text-red-700' : 'text-gray-600'}`}>
                          {isActive ? 'Restriction Active' : 'Restriction Inactive'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {isActive ? 'L\'utilisateur est actuellement restreint' : 'Aucune restriction en cours'}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setRestrictionForm((prev) => ({ ...prev, restricted: e.target.checked }))}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Active Restriction Details */}
                {isActive && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Dates Section */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <Calendar size={16} />
                        Période de restriction
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Date de début
                          </label>
                          <input
                            type="datetime-local"
                            value={restrictionForm.startDate}
                            onChange={(e) => setRestrictionForm((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1.5">Optionnel - Laissez vide pour commencer immédiatement</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-2">
                            Date de fin
                          </label>
                          <input
                            type="datetime-local"
                            value={restrictionForm.endDate}
                            onChange={(e) => setRestrictionForm((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1.5">Optionnel - Laissez vide pour une restriction permanente</p>
                        </div>
                      </div>
                    </div>

                    {/* Reason Section */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-amber-600" />
                        Raison de la restriction
                        <span className="text-xs font-normal text-gray-500">(interne, visible uniquement par les administrateurs)</span>
                      </label>
                      <textarea
                        value={restrictionForm.reason}
                        onChange={(e) => setRestrictionForm((prev) => ({ ...prev, reason: e.target.value }))}
                        placeholder="Ex: Spam détecté, comportement abusif, violation des règles..."
                        rows={3}
                        className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 resize-none transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Cette raison sera enregistrée dans l'historique des actions pour référence future.
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-indigo-100 rounded-lg">
                          <ShieldAlert size={16} className="text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-indigo-900 mb-1">Information importante</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">
                            Cette restriction sera appliquée immédiatement après validation. L'utilisateur sera notifié si nécessaire.
                            Les restrictions peuvent être modifiées ou supprimées à tout moment depuis cette page.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inactive State Info */}
                {!isActive && (
                  <div className="bg-green-50 rounded-xl p-5 border border-green-100 text-center">
                    <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-green-900 mb-1">
                      Aucune restriction active
                    </p>
                    <p className="text-xs text-green-700">
                      L'utilisateur peut utiliser toutes les fonctionnalités normalement.
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {actionError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 mb-1">Erreur</p>
                        <p className="text-sm text-red-700">{actionError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 px-6 py-4 flex-shrink-0">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeRestrictionModal}
                    className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRestriction}
                    disabled={restrictionLoading}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isActive 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    }`}
                  >
                    {restrictionLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        Traitement...
                      </span>
                    ) : isActive ? (
                      <span className="flex items-center justify-center gap-2">
                        <Ban size={16} />
                        Appliquer la restriction
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} />
                        Désactiver la restriction
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Received Orders Modal */}
      {ordersModal.open && ordersModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeOrdersModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Commandes reçues</h3>
                <p className="text-xs text-gray-500">{ordersModal.user.shopName || ordersModal.user.name}</p>
              </div>
              <button type="button" onClick={closeOrdersModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {ordersLoading ? (
                <p className="text-sm text-gray-500 text-center py-8">Chargement...</p>
              ) : receivedOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucune commande trouvée.</p>
              ) : (
                <div className="space-y-3">
                  {receivedOrders.map((order) => (
                    <div key={order.id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">#{order.orderNumber}</p>
                          <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        <p><strong>Acheteur:</strong> {order.buyer?.name || '—'} ({order.buyer?.phone || '—'})</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                            {item.product?.image && (
                              <img src={item.product.image} alt="" className="w-8 h-8 rounded object-cover" />
                            )}
                            <div className="text-xs">
                              <p className="font-medium text-gray-800 line-clamp-1">{item.product?.title || 'Produit'}</p>
                              <p className="text-gray-500">x{item.quantity} · {formatNumber(item.price)} FCFA</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {ordersTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t px-4 py-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => loadOrdersPage(ordersPage - 1)}
                  disabled={ordersPage <= 1 || ordersLoading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="text-xs text-gray-600">Page {ordersPage} / {ordersTotalPages}</span>
                <button
                  type="button"
                  onClick={() => loadOrdersPage(ordersPage + 1)}
                  disabled={ordersPage >= ordersTotalPages || ordersLoading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shop Conversion Request Modal */}
      {conversionModal.open && conversionModal.user && conversionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeConversionModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Demande de conversion en boutique</h3>
                <p className="text-xs text-gray-500">{conversionModal.user.name} ({conversionModal.user.email})</p>
              </div>
              <button type="button" onClick={closeConversionModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {conversionLoading ? (
                <p className="text-sm text-gray-500 text-center py-8">Traitement en cours...</p>
              ) : (
                <div className="space-y-6">
                  {/* Shop Information */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Store size={18} className="text-indigo-600" />
                      Informations de la boutique
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Nom de la boutique</label>
                        <p className="text-sm text-gray-900 mt-1">{conversionModal.request.shopName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Adresse</label>
                        <p className="text-sm text-gray-900 mt-1">{conversionModal.request.shopAddress}</p>
                      </div>
                      {conversionModal.request.shopDescription && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600">Description</label>
                          <p className="text-sm text-gray-900 mt-1">{conversionModal.request.shopDescription}</p>
                        </div>
                      )}
                      {conversionModal.request.shopLogo && (
                        <div className="md:col-span-2">
                          <label className="text-xs font-semibold text-gray-600">Logo</label>
                          <div className="mt-2">
                            <img
                              src={conversionModal.request.shopLogo}
                              alt="Logo boutique"
                              className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign size={18} className="text-blue-600" />
                      Informations de paiement
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Opérateur</label>
                        <p className="text-sm text-gray-900 mt-1 font-semibold">{conversionModal.request.operator || 'MTN'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Montant</label>
                        <p className="text-sm text-gray-900 mt-1 font-semibold">
                          {Number(conversionModal.request.paymentAmount || 50000).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                          <CreditCard size={14} />
                          Nom de la transaction
                        </label>
                        <p className="text-sm text-gray-900 mt-1">{conversionModal.request.transactionName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                          <Hash size={14} />
                          Numéro de transaction
                        </label>
                        <p className="text-sm text-gray-900 mt-1 font-mono">{conversionModal.request.transactionNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Proof */}
                  <div className="bg-green-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FileImage size={18} className="text-green-600" />
                      Preuve de paiement
                    </h4>
                    {conversionModal.request.paymentProof && (
                      <div className="mt-2">
                        <img
                          src={conversionModal.request.paymentProof}
                          alt="Preuve de paiement"
                          className="max-w-full h-auto rounded-lg border-2 border-gray-200 shadow-sm"
                          onError={(e) => {
                            e.target.src = '/api/placeholder/400/300';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Request Details */}
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Demande soumise le : {formatDate(conversionModal.request.createdAt)}</p>
                    {conversionModal.request.processedAt && (
                      <p>Traitée le : {formatDate(conversionModal.request.processedAt)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!conversionLoading && (
              <div className="flex items-center justify-end gap-3 border-t px-6 py-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeConversionModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectConversion(conversionModal.request._id)}
                  disabled={conversionLoading}
                  className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle size={16} className="inline mr-1" />
                  Rejeter
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveConversion(conversionModal.request._id)}
                  disabled={conversionLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={16} className="inline mr-1" />
                  Approuver
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModal.open && auditModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeAuditModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Historique des actions</h3>
                <p className="text-xs text-gray-500">{auditModal.user.name} ({auditModal.user.email})</p>
              </div>
              <button type="button" onClick={closeAuditModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {auditLoading ? (
                <p className="text-sm text-gray-500 text-center py-8">Chargement...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getActionColor(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {log.performedBy && (
                          <p>
                            <span className="font-semibold">Par:</span> {log.performedBy.name} ({log.performedBy.email})
                          </p>
                        )}
                        {log.details?.restrictionType && (
                          <p>
                            <span className="font-semibold">Restriction:</span> {log.details.restrictionLabel || log.details.restrictionType}
                          </p>
                        )}
                        {log.details?.reason && (
                          <p className="italic text-gray-500">
                            <span className="font-semibold not-italic">Raison:</span> {log.details.reason}
                          </p>
                        )}
                        {log.details?.previousRole && (
                          <p>
                            <span className="font-semibold">Rôle:</span> {log.details.previousRole} → {log.details.newRole}
                          </p>
                        )}
                        {log.details?.previousType && (
                          <p>
                            <span className="font-semibold">Type de compte:</span> {log.details.previousType === 'shop' ? 'Boutique' : 'Particulier'} → {log.details.newType === 'shop' ? 'Boutique' : 'Particulier'}
                          </p>
                        )}
                        {log.details?.shopName && (
                          <p>
                            <span className="font-semibold">Nom boutique:</span> {log.details.shopName}
                          </p>
                        )}
                        {log.details?.shopAddress && (
                          <p>
                            <span className="font-semibold">Adresse boutique:</span> {log.details.shopAddress}
                          </p>
                        )}
                        {log.details?.startDate && (
                          <p>
                            <span className="font-semibold">Début:</span> {formatDate(log.details.startDate)}
                          </p>
                        )}
                        {log.details?.endDate && (
                          <p>
                            <span className="font-semibold">Fin:</span> {formatDate(log.details.endDate)}
                          </p>
                        )}
                        {log.ipAddress && (
                          <p className="text-gray-400">
                            <span className="font-semibold">IP:</span> {log.ipAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t px-4 py-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => loadAuditPage(auditPage - 1)}
                  disabled={auditPage <= 1 || auditLoading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <span className="text-xs text-gray-600">Page {auditPage} / {auditTotalPages}</span>
                <button
                  type="button"
                  onClick={() => loadAuditPage(auditPage + 1)}
                  disabled={auditPage >= auditTotalPages || auditLoading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close restriction menu */}
      {restrictionMenuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setRestrictionMenuOpen(null)} />
      )}
    </div>
  );
}
