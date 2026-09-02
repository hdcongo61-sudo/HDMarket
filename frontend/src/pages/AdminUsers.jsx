import React, { useEffect, useMemo, useState, useCallback, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, ArrowLeftOnRectangleIcon, ArrowPathIcon, BuildingStorefrontIcon, CalendarIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ChevronDownIcon, ClockIcon, CreditCardIcon, CubeIcon, CurrencyDollarIcon, EllipsisVerticalIcon, EnvelopeIcon, ExclamationCircleIcon, EyeSlashIcon, HashtagIcon, HeartIcon, KeyIcon, LockClosedIcon, LockOpenIcon, MagnifyingGlassIcon, MapPinIcon, NoSymbolIcon, PhoneIcon, PhotoIcon, ShieldExclamationIcon, ShoppingCartIcon, TrophyIcon, TruckIcon, UserIcon, UserMinusIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { buildShopPath } from '../utils/links';
import api from '../services/api';
import useIsMobile from '../hooks/useIsMobile';
import VerifiedBadge from '../components/VerifiedBadge';
import BaseModal from '../components/modals/BaseModal';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import AuthContext from '../context/AuthContext';
import { appConfirm, appPrompt } from '../utils/appDialog';
import { hasAnyPermission } from '../utils/permissions';
import { resolveUserProfileImage } from '../utils/userAvatar';

const RESTRICTION_TYPES = [
  { key: 'canComment', label: 'Commentaires', icon: ChatBubbleLeftRightIcon, color: 'orange', shopOnly: false },
  { key: 'canOrder', label: 'Commandes', icon: ShoppingCartIcon, color: 'red', shopOnly: false },
  { key: 'canMessage', label: 'Messages', icon: ChatBubbleLeftRightIcon, color: 'purple', shopOnly: false },
  { key: 'canAddFavorites', label: 'Favoris', icon: HeartIcon, color: 'pink', shopOnly: false },
  { key: 'canUploadImages', label: 'Images', icon: PhotoIcon, color: 'blue', shopOnly: false },
  { key: 'canBeViewed', label: 'Visibilité boutique', icon: EyeSlashIcon, color: 'gray', shopOnly: true }
];

const accountTypeLabels = {
  person: 'Particulier',
  shop: 'Boutique'
};

const roleLabels = {
  user: 'Utilisateur',
  admin: 'Administrateur',
  manager: 'Gestionnaire',
  delivery_agent: 'Livreur',
  founder: 'Fondateur',
  seller: 'Vendeur',
  support: 'Support',
  finance: 'Finance',
  verifier: 'Vérificateur',
  payment_verifier: 'Vérificateur paiement'
};

const KNOWN_ROLE_ORDER = [
  'founder',
  'admin',
  'manager',
  'delivery_agent',
  'seller',
  'support',
  'finance',
  'verifier',
  'payment_verifier',
  'user'
];

const roleBadgeClasses = {
  founder: 'bg-violet-100 text-violet-700',
  admin: 'bg-rose-100 text-rose-700',
  manager: 'bg-blue-100 text-blue-700',
  delivery_agent: 'bg-cyan-100 text-cyan-700',
  seller: 'bg-teal-100 text-teal-700',
  support: 'bg-orange-100 text-orange-700',
  finance: 'bg-emerald-100 text-emerald-700',
  verifier: 'bg-fuchsia-100 text-fuchsia-700',
  payment_verifier: 'bg-indigo-100 text-indigo-700',
  user: 'bg-gray-100 text-gray-700'
};

const formatRoleLabel = (role) => {
  const key = String(role || '').trim().toLowerCase();
  if (!key) return 'Non défini';
  if (roleLabels[key]) return roleLabels[key];
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getRoleBadgeClass = (role) => {
  const key = String(role || '').trim().toLowerCase();
  return roleBadgeClasses[key] || 'bg-gray-100 text-gray-700';
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('fr-FR');
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const SYSTEM_SETTINGS_AUDIT_PREFIX = 'admin_system_settings_';
const FOUNDER_AUDIT_FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'system_settings', label: 'System settings' }
];

const getLocationCoordinates = (shopLocation) => {
  if (!shopLocation || !Array.isArray(shopLocation.coordinates) || shopLocation.coordinates.length !== 2) {
    return null;
  }
  const longitude = Number(shopLocation.coordinates[0]);
  const latitude = Number(shopLocation.coordinates[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
};

const formatCoordinates = (shopLocation) => {
  const parsed = getLocationCoordinates(shopLocation);
  if (!parsed) return 'Coordonnées indisponibles';
  return `${parsed.latitude.toFixed(6)}, ${parsed.longitude.toFixed(6)}`;
};

const formatLocationSource = (source) => {
  const value = String(source || '').trim().toLowerCase();
  if (!value) return 'Inconnu';
  const labels = {
    current: 'Position active',
    manual: 'Capture manuelle',
    geolocation_api: 'GPS navigateur',
    admin_approved: 'Validation admin',
    admin_rejected: 'Rejet admin'
  };
  return labels[value] || value.replaceAll('_', ' ');
};

const formatEntryCoordinates = (coordinates) => {
  const longitude = Number(coordinates?.longitude);
  const latitude = Number(coordinates?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return 'Coordonnées indisponibles';
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

const normalizeUserRow = (item = {}) => ({
  ...item,
  id: item.id || item._id || '',
  _id: item._id || item.id || '',
  role: String(item.role || 'user').toLowerCase(),
  isLocked: Boolean(item.isLocked),
  isActive: typeof item.isActive === 'boolean' ? item.isActive : !item.isBlocked,
  lockReason: item.lockReason || '',
  lockedAt: item.lockedAt || null,
  shopLocationNeedsReview: Boolean(item.shopLocationNeedsReview),
  shopLocationVerified: Boolean(item.shopLocationVerified),
  shopLocationTrustScore: Number.isFinite(Number(item.shopLocationTrustScore))
    ? Number(item.shopLocationTrustScore)
    : 0,
  shopLocationReviewStatus: item.shopLocationReviewStatus || 'approved',
  shopLocationReviewFlags: Array.isArray(item.shopLocationReviewFlags)
    ? item.shopLocationReviewFlags
    : [],
  shopLocationUpdatedAt: item.shopLocationUpdatedAt || null,
  shopLocationAccuracy:
    item.shopLocationAccuracy === null || item.shopLocationAccuracy === undefined
      ? null
      : Number(item.shopLocationAccuracy),
  shopLocation:
    item?.shopLocation &&
    Array.isArray(item.shopLocation.coordinates) &&
    item.shopLocation.coordinates.length === 2
      ? item.shopLocation
      : null
});

const USERS_PER_PAGE = 15;
const accountFilterOptions = [
  { value: 'all', label: 'Tous les types' },
  { value: 'person', label: 'Particuliers' },
  { value: 'shop', label: 'Boutiques' }
];
const statusFilterOptions = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'inactive', label: 'Désactivés' },
  { value: 'reactivation_pending', label: 'Réactivation demandée' },
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
  const { user: authUser } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(() => {
    const requestedStatus = searchParams.get('status');
    return statusFilterOptions.some((option) => option.value === requestedStatus)
      ? requestedStatus
      : 'all';
  });
  const [roleFilter, setRoleFilter] = useState('all');
  const [restrictionFilter, setRestrictionFilter] = useState('all');
  const [conversionFilter, setConversionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState('');
  const [verifyingShopId, setVerifyingShopId] = useState('');
  const [togglingChatTemplateUserId, setTogglingChatTemplateUserId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [securityActionKey, setSecurityActionKey] = useState('');
  const isMobileView = useIsMobile(1023);
  const isFounder = authUser?.role === 'founder';
  const canManageUsers = hasAnyPermission(authUser, ['manage_users']);
  const canManagePermissions = hasAnyPermission(authUser, ['manage_permissions']);
  const canManageSellers = hasAnyPermission(authUser, ['manage_sellers']);
  const canManageOrders = hasAnyPermission(authUser, ['manage_orders']);
  const canAssignRoles = hasAnyPermission(authUser, ['assign_roles']);
  const canRevokeRoles = hasAnyPermission(authUser, ['revoke_roles']);
  const canManageDeliveryProfiles =
    hasAnyPermission(authUser, ['manage_delivery']) || Boolean(authUser?.canManageDelivery);
  const canResetPasswords = hasAnyPermission(authUser, ['reset_passwords']);
  const canForceLogout = hasAnyPermission(authUser, ['force_logout']);
  const canLockAccounts = hasAnyPermission(authUser, ['lock_accounts']);
  const canViewLogs = hasAnyPermission(authUser, ['view_logs']);

  // Restriction modal state
  const [restrictionModal, setRestrictionModal] = useState({ open: false, user: null });
  const [restrictionMenuOpen, setRestrictionMenuOpen] = useState(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(null);
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
  const [auditModal, setAuditModal] = useState({ open: false, user: null, mode: 'user' });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditFilter, setAuditFilter] = useState('all');

  // Shop conversion request modal state
  const [conversionModal, setConversionModal] = useState({ open: false, user: null, request: null });
  const [conversionRequests, setConversionRequests] = useState([]);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [convertingUserId, setConvertingUserId] = useState('');
  const [locationReviewModal, setLocationReviewModal] = useState({
    open: false,
    user: null,
    decision: 'approve'
  });
  const [locationReviewReason, setLocationReviewReason] = useState('');
  const [locationReviewLoading, setLocationReviewLoading] = useState(false);
  const [locationTimelineModal, setLocationTimelineModal] = useState({
    open: false,
    user: null
  });
  const [locationTimelineEntries, setLocationTimelineEntries] = useState([]);
  const [locationTimelineLoading, setLocationTimelineLoading] = useState(false);

  useEffect(() => {
    const requestedStatus = searchParams.get('status');
    if (statusFilterOptions.some((option) => option.value === requestedStatus)) {
      setStatusFilter(requestedStatus);
      setPage(1);
    }
  }, [searchParams]);

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
        const [{ data }, { data: pendingData }] = await Promise.all([
          api.get('/admin/users', {
            params,
            signal: controller.signal
          }),
          api.get('/admin/users', {
            params: { limit: 100, reactivationStatus: 'pending' },
            signal: controller.signal
          })
        ]);
        if (isMounted) {
          const merged = new Map();
          for (const item of [
            ...(Array.isArray(pendingData) ? pendingData : []),
            ...(Array.isArray(data) ? data : [])
          ]) {
            const normalized = normalizeUserRow(item);
            merged.set(normalized.id, normalized);
          }
          setUsers(Array.from(merged.values()));
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

  const roleFilterOptions = useMemo(() => {
    const detectedRoles = new Set(
      users.map((entry) => String(entry?.role || 'user').toLowerCase()).filter(Boolean)
    );
    const ordered = KNOWN_ROLE_ORDER.filter((role) => detectedRoles.has(role));
    const extras = Array.from(detectedRoles)
      .filter((role) => !KNOWN_ROLE_ORDER.includes(role))
      .sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: 'Tous les rôles' },
      ...ordered.map((role) => ({ value: role, label: formatRoleLabel(role) })),
      ...extras.map((role) => ({ value: role, label: formatRoleLabel(role) }))
    ];
  }, [users]);

  const displayedUsers = useMemo(() => {
    let filtered = users;

    // Status filter
    if (statusFilter === 'blocked') {
      filtered = filtered.filter((user) => user.isBlocked);
    } else if (statusFilter === 'active') {
      filtered = filtered.filter((user) => !user.isBlocked && user.isActive !== false);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((user) => user.isActive === false);
    } else if (statusFilter === 'reactivation_pending') {
      filtered = filtered.filter(
        (user) => user.reactivationRequest?.status === 'pending'
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => String(user.role || '').toLowerCase() === roleFilter);
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
  }, [statusFilter, roleFilter, restrictionFilter, conversionFilter, users, conversionRequests]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => !user.isBlocked && user.isActive !== false).length;
    const blocked = users.filter((user) => user.isBlocked).length;
    const shops = users.filter((user) => user.accountType === 'shop').length;
    const restricted = users.filter((user) =>
      RESTRICTION_TYPES.some((rt) => user.restrictions?.[rt.key]?.isActive)
    ).length;
    const roleBuckets = users.reduce((acc, user) => {
      const key = String(user?.role || 'user').toLowerCase();
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {});
    const pendingConversion = conversionRequests.length;
    return {
      total,
      active,
      blocked,
      shops,
      restricted,
      pendingConversion,
      roleBuckets,
      deliveryAgents: Number(roleBuckets.delivery_agent || 0)
    };
  }, [users, conversionRequests]);

  useEffect(() => {
    setPage(1);
  }, [accountTypeFilter, statusFilter, roleFilter, restrictionFilter, conversionFilter, searchTerm]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = setTimeout(() => setActionSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [actionSuccess]);

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

  const upsertUser = useCallback((nextUser) => {
    const normalizedNext = normalizeUserRow(nextUser);
    setUsers((prev) => {
      const exists = prev.some((user) => user.id === normalizedNext.id);
      if (exists) {
        return prev.map((user) => (user.id === normalizedNext.id ? normalizedNext : user));
      }
      return [normalizedNext, ...prev];
    });
  }, []);

  const handleBlock = async (user) => {
    const defaultReason = user.blockedReason || '';
    const reason = await appPrompt(
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

  const handleReactivationReview = async (user, decision) => {
    const approving = decision === 'approve';
    let note = '';
    if (approving) {
      const confirmed = await appConfirm(
        `Réactiver le compte de ${user.name || user.email} et restaurer ses annonces ?`
      );
      if (!confirmed) return;
    } else {
      const response = await appPrompt(
        'Motif du refus (facultatif, conservé dans l’historique) :',
        ''
      );
      if (response === null) return;
      note = response;
    }

    setActionError('');
    setActionSuccess('');
    setPendingUserId(user.id);
    try {
      const { data } = await api.patch(`/admin/users/${user.id}/reactivation-request`, {
        decision,
        note
      });
      upsertUser(data.user);
      setActionSuccess(data?.message || (approving ? 'Compte réactivé.' : 'Demande refusée.'));
    } catch (requestError) {
      setActionError(
        requestError?.response?.data?.message ||
          'Impossible de traiter cette demande de réactivation.'
      );
    } finally {
      setPendingUserId('');
    }
  };

  const openConversionModal = (user) => {
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    const request = conversionRequests.find((r) => r.user?._id === user.id || r.user === user.id);
    setConversionModal({ open: true, user, request });
  };

  const closeConversionModal = () => {
    setConversionModal({ open: false, user: null, request: null });
  };

  const handleApproveConversion = async (requestId) => {
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
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
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    const reason = await appPrompt('Raison du rejet (facultatif) :', '');
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
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    const shopName = await appPrompt('Nom de la boutique :', user.shopName || '');
    if (shopName === null) return;
    if (!shopName.trim()) {
      setActionError('Le nom de la boutique est requis.');
      return;
    }
    const shopAddress = await appPrompt('Adresse de la boutique :', user.shopAddress || '');
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
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    const confirmed = await appConfirm(
      `Êtes-vous sûr de vouloir reconvertir "${user.name}" (${user.shopName || 'Boutique'}) en compte particulier ?\n\nLes informations de boutique seront conservées pour une reconversion ultérieure.`
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

  const handlePromoteToDeliveryGuy = async (user) => {
    if (!user?.id) return;
    if (!(canManagePermissions || canAssignRoles || canManageDeliveryProfiles)) {
      setActionError("Vous n'avez pas la permission de gérer les livreurs.");
      return;
    }

    await runSecurityAction({
      key: `promote-delivery:${user.id}`,
      request: () => api.post(`/admin/users/${user.id}/promote-delivery-guy`),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
        setRefreshKey((k) => k + 1);
      }
    });
  };

  const handleUnlinkDeliveryGuy = async (user) => {
    if (!user?.id) return;
    if (!(canManagePermissions || canAssignRoles || canManageDeliveryProfiles)) {
      setActionError("Vous n'avez pas la permission de gérer les livreurs.");
      return;
    }

    await runSecurityAction({
      key: `unlink-delivery:${user.id}`,
      request: () => api.post(`/admin/users/${user.id}/unlink-delivery-guy`),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
        setRefreshKey((k) => k + 1);
      }
    });
  };

  const toggleShopVerification = useCallback(async (id, nextValue) => {
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    setVerifyingShopId(id);
    setActionError('');
    try {
      const { data } = await api.patch(`/admin/users/${id}/shop-verification`, {
        verified: nextValue
      });
      upsertUser(data);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de mettre à jour l’état de vérification de la boutique.'
      );
    } finally {
      setVerifyingShopId('');
    }
  }, [canManageSellers]);

  const openLocationReviewModal = useCallback((user, decision) => {
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    setActionError('');
    setLocationReviewReason('');
    setLocationReviewModal({
      open: true,
      user,
      decision: decision === 'reject' ? 'reject' : 'approve'
    });
  }, [canManageSellers]);

  const closeLocationReviewModal = useCallback(() => {
    setLocationReviewModal({ open: false, user: null, decision: 'approve' });
    setLocationReviewReason('');
  }, []);

  const submitLocationReview = useCallback(async () => {
    const modalUser = locationReviewModal.user;
    if (!modalUser?.id) return;
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    const decision = locationReviewModal.decision === 'reject' ? 'reject' : 'approve';
    if (decision === 'reject' && String(locationReviewReason || '').trim().length < 3) {
      setActionError('Veuillez saisir une raison de rejet (minimum 3 caractères).');
      return;
    }

    setLocationReviewLoading(true);
    setActionError('');
    try {
      const { data } = await api.patch(`/admin/users/${modalUser.id}/shop-location-review`, {
        decision,
        reason: String(locationReviewReason || '').trim()
      });
      if (data?.user) {
        upsertUser(data.user);
      }
      setActionSuccess(
        data?.message ||
          (decision === 'approve'
            ? 'Localisation boutique approuvée.'
            : 'Localisation boutique rejetée.')
      );
      closeLocationReviewModal();
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de traiter la revue de localisation.'
      );
    } finally {
      setLocationReviewLoading(false);
    }
  }, [
    canManageSellers,
    closeLocationReviewModal,
    locationReviewModal.decision,
    locationReviewModal.user,
    locationReviewReason,
    upsertUser
  ]);

  const openLocationTimelineModal = useCallback(async (user) => {
    if (!user?.id) return;
    if (!canManageSellers) {
      setActionError("Vous n'avez pas la permission de gérer les boutiques.");
      return;
    }
    setLocationTimelineModal({ open: true, user });
    setLocationTimelineLoading(true);
    setActionError('');
    try {
      const { data } = await api.get(`/admin/users/${user.id}/shop-location-timeline`, {
        params: { limit: 80 }
      });
      setLocationTimelineEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Impossible de charger le timeline de localisation.'
      );
      setLocationTimelineEntries([]);
    } finally {
      setLocationTimelineLoading(false);
    }
  }, [canManageSellers]);

  const closeLocationTimelineModal = useCallback(() => {
    setLocationTimelineModal({ open: false, user: null });
    setLocationTimelineEntries([]);
  }, []);

  const handleToggleChatTemplateAccess = async (user) => {
    if (!user?.id) return;
    if (!canManagePermissions) {
      setActionError("Vous n'avez pas la permission de modifier les accès.");
      return;
    }
    if (['admin', 'founder'].includes(user.role)) {
      setActionError("Impossible de modifier les permissions d'un administrateur ou fondateur.");
      return;
    }
    setActionError('');
    setTogglingChatTemplateUserId(user.id);
    try {
      const { data } = await api.patch(`/admin/chat-template-managers/${user.id}/toggle`);
      const nextGranted = Boolean(data?.user?.canManageChatTemplates);
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, canManageChatTemplates: nextGranted } : item
        )
      );
    } catch (e) {
      setActionError(
        e.response?.data?.message ||
          e.message ||
          "Impossible de mettre à jour l'accès templates chat."
      );
    } finally {
      setTogglingChatTemplateUserId('');
    }
  };

  const getUserConversionRequest = (userId) => {
    return conversionRequests.find((r) => r.user?._id === userId || r.user === userId);
  };

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1);
  };

  const canActOnTargetUser = useCallback((targetUser) => {
    const targetRole = String(targetUser?.role || '').toLowerCase();
    const actorRole = String(authUser?.role || '').toLowerCase();
    if (!targetRole || !actorRole) return false;
    if (actorRole === 'founder') return targetRole !== 'founder';
    if (actorRole === 'admin') return targetRole !== 'admin' && targetRole !== 'founder';
    return false;
  }, [authUser?.role]);

  const runSecurityAction = useCallback(async ({ key, request, onSuccess }) => {
    setActionError('');
    setActionSuccess('');
    setSecurityActionKey(key);
    try {
      const response = await request();
      const successMessage = String(response?.data?.message || '').trim();
      if (successMessage) {
        setActionSuccess(successMessage);
      }
      if (typeof onSuccess === 'function') {
        onSuccess(response);
      }
      return response;
    } catch (e) {
      setActionSuccess('');
      setActionError(
        e.response?.data?.message ||
          e.message ||
          'Action sécurité impossible pour le moment.'
      );
      return null;
    } finally {
      setSecurityActionKey('');
    }
  }, []);

  const handlePromoteAdmin = async (user) => {
    if (!user?.id) return;
    await runSecurityAction({
      key: `promote:${user.id}`,
      request: () => api.post(`/founder/promote-admin/${user.id}`),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
      }
    });
  };

  const handleRevokeAdmin = async (user) => {
    if (!user?.id) return;
    await runSecurityAction({
      key: `revoke:${user.id}`,
      request: () => api.post(`/founder/revoke-admin/${user.id}`),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
      }
    });
  };

  const handleForcePasswordReset = async (user) => {
    if (!user?.id) return;
    const mode = await appPrompt(
      'Choisir la méthode:\n1 = Envoyer un lien par email\n2 = Définir le mot de passe directement',
      '1'
    );
    if (mode === null) return;

    if (String(mode).trim() === '2') {
      const newPassword = await appPrompt('Nouveau mot de passe (minimum 6 caractères):', '');
      if (newPassword === null) return;
      if (String(newPassword).length < 6) {
        setActionError('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      const confirmPassword = await appPrompt('Confirmez le nouveau mot de passe:', '');
      if (confirmPassword === null) return;
      if (String(confirmPassword) !== String(newPassword)) {
        setActionError('La confirmation du mot de passe ne correspond pas.');
        return;
      }

      await runSecurityAction({
        key: `set-password:${user.id}`,
        request: () =>
          api.post(`/admin/users/${user.id}/set-password`, {
            newPassword,
            forceLogout: true
          }),
        onSuccess: (result) => {
          const nextUser = result?.data?.user;
          if (nextUser) upsertUser(nextUser);
        }
      });
      return;
    }

    const endpoint = isFounder
      ? `/founder/force-reset-password/${user.id}`
      : `/admin/users/${user.id}/force-password-reset`;
    const response = await runSecurityAction({
      key: `reset:${user.id}`,
      request: () => api.post(endpoint)
    });
    const resetLink = String(response?.data?.resetLink || '').trim();
    if (!resetLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(resetLink);
        setActionSuccess((prev) =>
          prev ? `${prev} Le lien a été copié.` : 'Lien de réinitialisation copié.'
        );
        return;
      }
    } catch {
      // Fallback handled below with prompt.
    }
    appPrompt('Copiez ce lien de réinitialisation manuel :', resetLink);
  };

  const handleForceLogout = async (user) => {
    if (!user?.id) return;
    const endpoint = isFounder
      ? `/founder/force-logout/${user.id}`
      : `/admin/users/${user.id}/force-logout`;
    await runSecurityAction({
      key: `logout:${user.id}`,
      request: () => api.post(endpoint),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
      }
    });
  };

  const handleLockAccount = async (user) => {
    if (!user?.id) return;
    const defaultReason = user?.lockReason || '';
    const reason = await appPrompt('Motif du verrouillage (facultatif) :', defaultReason);
    if (reason === null) return;
    const endpoint = isFounder
      ? `/founder/lock-user/${user.id}`
      : `/admin/users/${user.id}/lock-account`;
    await runSecurityAction({
      key: `lock:${user.id}`,
      request: () => api.post(endpoint, { reason: reason || '' }),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
      }
    });
  };

  const handleUnlockAccount = async (user) => {
    if (!user?.id) return;
    const endpoint = isFounder
      ? `/founder/unlock-user/${user.id}`
      : `/admin/users/${user.id}/unlock-account`;
    await runSecurityAction({
      key: `unlock:${user.id}`,
      request: () => api.post(endpoint),
      onSuccess: (response) => {
        const nextUser = response?.data?.user;
        if (nextUser) upsertUser(nextUser);
      }
    });
  };

  // Restriction handlers
  const openRestrictionModal = useCallback((user, restrictionType) => {
    if (!canManageUsers) {
      setActionError("Vous n'avez pas la permission de gérer les utilisateurs.");
      return;
    }
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
  }, [canManageUsers]);

  const closeRestrictionModal = useCallback(() => {
    setRestrictionModal({ open: false, user: null });
    setRestrictionForm({ type: '', restricted: false, startDate: '', endDate: '', reason: '' });
  }, []);

  const handleApplyRestriction = async () => {
    if (!canManageUsers) {
      setActionError("Vous n'avez pas la permission de gérer les utilisateurs.");
      return;
    }
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
      setUsers(Array.isArray(data) ? data.map(normalizeUserRow) : []);
      closeRestrictionModal();
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Erreur lors de l\'application de la restriction.');
    } finally {
      setRestrictionLoading(false);
    }
  };

  const handleRemoveRestriction = async (userId, restrictionType) => {
    if (!canManageUsers) {
      setActionError("Vous n'avez pas la permission de gérer les utilisateurs.");
      return;
    }
    setRestrictionLoading(true);
    setActionError('');
    try {
      await api.delete(`/admin/users/${userId}/restrictions/${restrictionType}`);
      const { data } = await api.get('/admin/users', { params: { limit: 100, search: searchTerm || undefined, accountType: accountTypeFilter !== 'all' ? accountTypeFilter : undefined } });
      setUsers(Array.isArray(data) ? data.map(normalizeUserRow) : []);
    } catch (e) {
      setActionError(e.response?.data?.message || e.message || 'Erreur lors de la suppression de la restriction.');
    } finally {
      setRestrictionLoading(false);
    }
  };

  // Received orders handlers
  const openOrdersModal = useCallback(async (user) => {
    if (!canManageOrders) {
      setActionError("Vous n'avez pas la permission de gérer les commandes.");
      return;
    }
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
  }, [canManageOrders]);

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
  const getFounderAuditParams = useCallback((pageValue, filterValue = 'all') => {
    const params = { page: pageValue, limit: 20 };
    if (filterValue === 'system_settings') {
      params.actionPrefix = SYSTEM_SETTINGS_AUDIT_PREFIX;
    }
    return params;
  }, []);

  const openAuditModal = useCallback(async (user) => {
    if (!canViewLogs) {
      setActionError("Vous n'avez pas la permission de consulter les logs.");
      return;
    }
    setAuditModal({ open: true, user, mode: 'user' });
    setAuditFilter('all');
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
  }, [canViewLogs]);

  const openFounderAuditModal = useCallback(async () => {
    if (!isFounder || !canViewLogs) {
      setActionError("Vous n'avez pas la permission de consulter le timeline founder.");
      return;
    }
    const nextFilter = 'system_settings';
    setAuditModal({ open: true, user: null, mode: 'founder' });
    setAuditFilter(nextFilter);
    setAuditLoading(true);
    setAuditPage(1);
    try {
      const { data } = await api.get('/founder/audit-logs', {
        params: getFounderAuditParams(1, nextFilter)
      });
      setAuditLogs(Array.isArray(data.items) ? data.items : []);
      setAuditTotalPages(Number(data.pages || 1));
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement du timeline founder.');
    } finally {
      setAuditLoading(false);
    }
  }, [canViewLogs, isFounder, getFounderAuditParams]);

  const closeAuditModal = useCallback(() => {
    setAuditModal({ open: false, user: null, mode: 'user' });
    setAuditFilter('all');
    setAuditLogs([]);
  }, []);

  const loadAuditPage = async (newPage) => {
    if (!auditModal.user && auditModal.mode !== 'founder') return;
    setAuditLoading(true);
    try {
      if (auditModal.mode === 'founder') {
        const { data } = await api.get('/founder/audit-logs', {
          params: getFounderAuditParams(newPage, auditFilter)
        });
        setAuditLogs(Array.isArray(data.items) ? data.items : []);
        setAuditTotalPages(Number(data.pages || 1));
      } else {
        const { data } = await api.get(`/admin/users/${auditModal.user.id}/audit-logs`, { params: { page: newPage, limit: 10 } });
        setAuditLogs(data.logs || []);
        setAuditTotalPages(data.totalPages || 0);
      }
      setAuditPage(newPage);
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du chargement de l\'historique.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleFounderAuditFilterChange = async (nextFilter) => {
    if (auditModal.mode !== 'founder') return;
    if (nextFilter === auditFilter) return;
    setAuditFilter(nextFilter);
    setAuditLoading(true);
    setAuditPage(1);
    try {
      const { data } = await api.get('/founder/audit-logs', {
        params: getFounderAuditParams(1, nextFilter)
      });
      setAuditLogs(Array.isArray(data.items) ? data.items : []);
      setAuditTotalPages(Number(data.pages || 1));
    } catch (e) {
      setActionError(e.response?.data?.message || 'Erreur lors du filtrage du timeline founder.');
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
      role_promoted_admin: 'Promotion admin',
      role_revoked_admin: 'Révocation admin',
      account_type_changed: 'Type de compte modifié',
      account_type_changed_to_shop: 'Converti en boutique',
      account_type_changed_to_person: 'Reconverti en particulier',
      shop_location_review_approved: 'Localisation approuvée',
      shop_location_review_rejected: 'Localisation rejetée',
      account_locked: 'Compte verrouillé',
      account_unlocked: 'Compte déverrouillé',
      force_logout_user: 'Force logout',
      force_password_reset: 'Reset mot de passe forcé',
      admin_trigger_password_reset: 'Reset mot de passe admin',
      admin_set_password_direct: 'Mot de passe défini (direct)',
      password_reset_link_sent: 'Lien reset envoyé',
      password_reset_completed: 'Mot de passe réinitialisé',
      admin_system_settings_fee_updated: 'Paramètre frais modifié',
      admin_system_settings_runtime_updated: 'Runtime modifié',
      admin_system_settings_runtime_bulk_updated: 'Runtime modifié (bulk)',
      admin_system_settings_feature_flag_updated: 'Feature flag modifié',
      admin_system_settings_languages_updated: 'Langues modifiées',
      admin_system_settings_currency_created: 'Devise créée',
      admin_system_settings_currency_updated: 'Devise modifiée',
      admin_system_settings_city_created: 'Ville créée',
      admin_system_settings_city_updated: 'Ville modifiée',
      admin_system_settings_city_deleted: 'Ville supprimée',
      admin_system_settings_commune_created: 'Commune créée',
      admin_system_settings_commune_updated: 'Commune modifiée',
      admin_system_settings_commune_deleted: 'Commune supprimée'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const key = String(action || '');
    if (!key) return 'bg-neutral-100 text-neutral-700';
    if (
      key.includes('blocked') ||
      key.includes('applied') ||
      key === 'shop_unverified' ||
      key === 'account_locked' ||
      key === 'shop_location_review_rejected'
    ) {
      return 'bg-red-100 text-red-700';
    }
    if (
      key.includes('unblocked') ||
      key.includes('removed') ||
      key === 'shop_verified' ||
      key === 'account_unlocked' ||
      key === 'shop_location_review_approved'
    ) {
      return 'bg-green-100 text-green-700';
    }
    if (key.includes('role_')) {
      return 'bg-indigo-100 text-indigo-700';
    }
    if (key.includes('reset') || key.includes('logout')) {
      return 'bg-amber-100 text-amber-700';
    }
    if (key.includes('account_type_changed')) {
      return 'bg-neutral-100 text-neutral-700';
    }
    return 'bg-neutral-100 text-neutral-700';
  };

  // Get active restrictions count for a user
  const getActiveRestrictionsCount = (user) => {
    if (!user.restrictions) return 0;
    return RESTRICTION_TYPES.filter((rt) => user.restrictions[rt.key]?.isActive).length;
  };

  // Consolidated "more actions" menu shared by the mobile card and desktop
  // table row — folds every secondary action (conversion, delivery-agent
  // linking, shop verification, GPS review, audit log, security actions,
  // stats) into one dropdown so the primary row only shows Suspendre +
  // Restrictions, instead of the 10-button wrap seen on both layouts.
  const renderUserMenuItems = useCallback((user, closeMenu) => {
    const targetRole = String(user?.role || '').toLowerCase();
    const canTarget = canActOnTargetUser(user);
    const isTargetLocked = Boolean(user?.isLocked);
    const isShopAccount = user.accountType === 'shop';
    const hasShopLocation = Boolean(getLocationCoordinates(user.shopLocation));
    const conversionRequest = getUserConversionRequest(user.id);
    const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed';
    const run = (fn) => () => { closeMenu(); fn(); };

    return (
      <>
        {user.accountType !== 'shop' && conversionRequest && (
          <button type="button" onClick={run(() => openConversionModal(user))} className={itemClass}>
            <BuildingStorefrontIcon className="text-neutral-400 h-3.5 w-3.5" /> Demande boutique
          </button>
        )}
        {user.accountType !== 'shop' && !conversionRequest && (
          <button
            type="button"
            onClick={run(() => handleConvertToShop(user))}
            disabled={!canManageSellers || convertingUserId === user.id}
            className={itemClass}
          >
            <BuildingStorefrontIcon className="text-teal-500 h-3.5 w-3.5" /> Convertir en boutique
          </button>
        )}
        {user.accountType === 'shop' && (
          <button
            type="button"
            onClick={run(() => handleConvertToParticulier(user))}
            disabled={!canManageSellers || convertingUserId === user.id}
            className={itemClass}
          >
            <UserIcon className="text-orange-500 h-3.5 w-3.5" /> Reconvertir en particulier
          </button>
        )}
        {!['admin', 'founder'].includes(targetRole) && (
          <button
            type="button"
            onClick={run(() => handlePromoteToDeliveryGuy(user))}
            disabled={
              !(canManagePermissions || canAssignRoles || canManageDeliveryProfiles) ||
              securityActionKey === `promote-delivery:${user.id}`
            }
            className={itemClass}
          >
            <TruckIcon className="text-cyan-500 h-3.5 w-3.5" />
            {targetRole === 'delivery_agent' ? 'Lier profil livreur' : 'Promouvoir livreur'}
          </button>
        )}
        {targetRole === 'delivery_agent' && (
          <button
            type="button"
            onClick={run(() => handleUnlinkDeliveryGuy(user))}
            disabled={
              !(canManagePermissions || canAssignRoles || canManageDeliveryProfiles) ||
              securityActionKey === `unlink-delivery:${user.id}`
            }
            className={itemClass}
          >
            <TruckIcon className="text-amber-500 h-3.5 w-3.5" /> Délier profil livreur
          </button>
        )}
        {isShopAccount && (
          <button
            type="button"
            onClick={run(() => toggleShopVerification(user.id, !user.shopVerified))}
            disabled={!canManageSellers || verifyingShopId === user.id}
            className={itemClass}
          >
            <CheckCircleIcon className={user.shopVerified ? 'text-amber-500' : 'text-emerald-500'} className="h-3.5 w-3.5" />
            {user.shopVerified ? 'Retirer le badge certifié' : 'Vérifier la boutique'}
          </button>
        )}
        {isShopAccount && (
          <button type="button" onClick={run(() => openOrdersModal(user))} disabled={!canManageOrders} className={itemClass}>
            <CubeIcon className="text-neutral-400 h-3.5 w-3.5" /> Commandes reçues
          </button>
        )}
        {isShopAccount && user.shopLocationNeedsReview && (
          <>
            <button
              type="button"
              onClick={run(() => openLocationReviewModal(user, 'approve'))}
              disabled={!canManageSellers || locationReviewLoading}
              className={itemClass}
            >
              <CheckCircleIcon className="text-emerald-500 h-3.5 w-3.5" /> Approuver position GPS
            </button>
            <button
              type="button"
              onClick={run(() => openLocationReviewModal(user, 'reject'))}
              disabled={!canManageSellers || locationReviewLoading}
              className={itemClass}
            >
              <XCircleIcon className="text-red-500 h-3.5 w-3.5" /> Rejeter position GPS
            </button>
          </>
        )}
        {isShopAccount && (hasShopLocation || user.shopLocationNeedsReview) && (
          <button
            type="button"
            onClick={run(() => openLocationTimelineModal(user))}
            disabled={!canManageSellers || locationTimelineLoading}
            className={itemClass}
          >
            <MapPinIcon className="text-sky-500 h-3.5 w-3.5" /> Timeline GPS
          </button>
        )}
        {canViewLogs && (
          <button type="button" onClick={run(() => openAuditModal(user))} className={itemClass}>
            <ClockIcon className="text-neutral-400 h-3.5 w-3.5" /> Historique des actions
          </button>
        )}
        {isFounder && targetRole !== 'founder' && targetRole !== 'admin' && (canAssignRoles || canManagePermissions) && (
          <button
            type="button"
            onClick={run(() => handlePromoteAdmin(user))}
            disabled={!canTarget || securityActionKey === `promote:${user.id}`}
            className={itemClass}
          >
            <TrophyIcon className="text-indigo-500 h-3.5 w-3.5" /> Promouvoir admin
          </button>
        )}
        {isFounder && targetRole === 'admin' && (canRevokeRoles || canManagePermissions) && (
          <button
            type="button"
            onClick={run(() => handleRevokeAdmin(user))}
            disabled={!canTarget || securityActionKey === `revoke:${user.id}`}
            className={itemClass}
          >
            <ShieldExclamationIcon className="text-purple-500 h-3.5 w-3.5" /> Révoquer admin
          </button>
        )}
        {canLockAccounts && (
          isTargetLocked ? (
            <button
              type="button"
              onClick={run(() => handleUnlockAccount(user))}
              disabled={!canTarget || securityActionKey === `unlock:${user.id}`}
              className={itemClass}
            >
              <LockOpenIcon className="text-green-500 h-3.5 w-3.5" /> Déverrouiller le compte
            </button>
          ) : (
            <button
              type="button"
              onClick={run(() => handleLockAccount(user))}
              disabled={!canTarget || securityActionKey === `lock:${user.id}`}
              className={itemClass}
            >
              <LockClosedIcon className="text-red-500 h-3.5 w-3.5" /> Verrouiller le compte
            </button>
          )
        )}
        {canResetPasswords && (
          <button
            type="button"
            onClick={run(() => handleForcePasswordReset(user))}
            disabled={
              !canTarget ||
              securityActionKey === `reset:${user.id}` ||
              securityActionKey === `set-password:${user.id}`
            }
            className={itemClass}
          >
            <KeyIcon className="text-amber-500 h-3.5 w-3.5" /> Modifier le mot de passe
          </button>
        )}
        {canForceLogout && (
          <button
            type="button"
            onClick={run(() => handleForceLogout(user))}
            disabled={!canTarget || securityActionKey === `logout:${user.id}`}
            className={itemClass}
          >
            <ArrowLeftOnRectangleIcon className="text-neutral-500 h-3.5 w-3.5" /> Forcer la déconnexion
          </button>
        )}
        <Link to={`/admin/users/${user.id}/stats`} onClick={closeMenu} className={itemClass}>
          <ChartBarIcon className="text-[#e85d00] h-3.5 w-3.5" /> Voir les statistiques
        </Link>
      </>
    );
  }, [
    canActOnTargetUser,
    canAssignRoles,
    canForceLogout,
    canLockAccounts,
    canManageOrders,
    canManagePermissions,
    canManageDeliveryProfiles,
    canManageSellers,
    canResetPasswords,
    canRevokeRoles,
    canViewLogs,
    convertingUserId,
    getLocationCoordinates,
    getUserConversionRequest,
    handleConvertToParticulier,
    handleConvertToShop,
    handleForceLogout,
    handleForcePasswordReset,
    handleLockAccount,
    handlePromoteAdmin,
    handlePromoteToDeliveryGuy,
    handleRevokeAdmin,
    handleUnlinkDeliveryGuy,
    handleUnlockAccount,
    isFounder,
    locationReviewLoading,
    locationTimelineLoading,
    openAuditModal,
    openConversionModal,
    openLocationReviewModal,
    openLocationTimelineModal,
    openOrdersModal,
    securityActionKey,
    toggleShopVerification,
    verifyingShopId
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-5 md:px-6 lg:px-8">
      {/* ─── Professional Dashboard Header ─── */}
      <header className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50/50 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0E4] text-[#e85d00]">
                <ShieldExclamationIcon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#e85d00]">Communauté</p>
                <h1 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
                  Utilisateurs &amp; Rôles
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isFounder && canViewLogs && (
                <button
                  type="button"
                  onClick={openFounderAuditModal}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  Timeline
                </button>
              )}
              <Link
                to="/admin"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                <ArrowPathIcon className={loading ? 'animate-spin' : ''} className="h-3.5 w-3.5" />
                Actualiser
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
              {displayedUsers.length} utilisateur{displayedUsers.length !== 1 ? 's' : ''}
            </span>
            {roleFilter !== 'all' && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getRoleBadgeClass(roleFilter)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                {formatRoleLabel(roleFilter)}
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                <MagnifyingGlassIcon className="h-3 w-3" />
                &quot;{searchTerm}&quot;
              </span>
            )}
          </div>
        </div>

        {/* ─── Stats Grid ─── */}
        <div className="grid grid-cols-2 gap-px bg-neutral-100 sm:grid-cols-3 xl:grid-cols-6">
          {/* Total */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100">
                <UserIcon className="text-neutral-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Total</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{formatNumber(stats.total)}</p>
          </div>
          {/* Actifs */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircleIcon className="text-emerald-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Actifs</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600">{formatNumber(stats.active)}</p>
          </div>
          {/* Suspendus */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100">
                <NoSymbolIcon className="text-red-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Suspendus</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-red-600">{formatNumber(stats.blocked)}</p>
          </div>
          {/* Boutiques */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                <BuildingStorefrontIcon className="text-violet-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Boutiques</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900">{formatNumber(stats.shops)}</p>
          </div>
          {/* Livreurs */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-100">
                <TruckIcon className="text-cyan-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Livreurs</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-cyan-600">{formatNumber(stats.deliveryAgents)}</p>
          </div>
          {/* Demandes shop */}
          <div className="flex flex-col gap-1 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <ClockIcon className="text-amber-600 h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">En attente</p>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-amber-600">{formatNumber(stats.pendingConversion)}</p>
          </div>
        </div>
      </header>

      {/* ─── Role Distribution + Filters ─── */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Role Filter — single control, doubles as the role distribution readout */}
        {roleFilterOptions.length > 1 && (
          <div className="border-b border-neutral-100 px-4 py-3 sm:px-5">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Rôles</p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  roleFilter === 'all'
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Tous
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  roleFilter === 'all' ? 'bg-white/20' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {formatNumber(stats.total)}
                </span>
              </button>
              {roleFilterOptions
                .filter((option) => option.value !== 'all')
                .map((option) => {
                  const count = Number(stats.roleBuckets?.[option.value] || 0);
                  const active = roleFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRoleFilter(active ? 'all' : option.value)}
                      aria-pressed={active}
                      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? `${getRoleBadgeClass(option.value)} shadow-sm ring-1 ring-inset ring-current/25`
                          : 'border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {option.label}
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-white/30' : 'bg-neutral-200 text-neutral-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* MagnifyingGlassIcon + Filters */}
        <form onSubmit={handleSearchSubmit} className="px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* MagnifyingGlassIcon bar */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 h-4 w-4" />
              <input
                type="search"
                placeholder="Rechercher nom, email ou téléphone…"
                className="min-h-0 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 transition"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* Desktop filters */}
            {!isMobileView ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={accountTypeFilter}
                  onChange={(e) => setAccountTypeFilter(e.target.value)}
                  className="w-auto min-h-0 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium text-neutral-700 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                >
                  {accountFilterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-auto min-h-0 rounded-lg border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
                    statusFilter !== 'all'
                      ? 'border-neutral-400 bg-neutral-100 text-neutral-800'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  {statusFilterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={restrictionFilter}
                  onChange={(e) => setRestrictionFilter(e.target.value)}
                  className={`w-auto min-h-0 rounded-lg border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
                    restrictionFilter !== 'all'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  {restrictionFilterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={conversionFilter}
                  onChange={(e) => setConversionFilter(e.target.value)}
                  className={`w-auto min-h-0 rounded-lg border px-2.5 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-400 ${
                    conversionFilter !== 'all'
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  {conversionFilterOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                Rechercher
              </button>
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Mobile filter pills */}
          {isMobileView && (
            <div className="mt-3 space-y-2">
              {[
                { label: 'Type', options: accountFilterOptions, value: accountTypeFilter, setter: setAccountTypeFilter, activeClass: 'bg-neutral-900 text-white' },
                { label: 'Statut', options: statusFilterOptions, value: statusFilter, setter: setStatusFilter, activeClass: 'bg-neutral-900 text-white' },
                { label: 'Restriction', options: restrictionFilterOptions, value: restrictionFilter, setter: setRestrictionFilter, activeClass: 'bg-amber-600 text-white' },
                { label: 'Conversion', options: conversionFilterOptions, value: conversionFilter, setter: setConversionFilter, activeClass: 'bg-teal-600 text-white' }
              ].map((group) => (
                <div key={group.label} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 w-16 shrink-0">{group.label}</span>
                  <div className="flex gap-1 overflow-x-auto pb-0.5">
                    {group.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => group.setter(option.value)}
                        className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                          group.value === option.value
                            ? group.activeClass || `${getRoleBadgeClass(option.value)} shadow-sm`
                            : 'border border-neutral-200 bg-white text-neutral-500'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* ─── Messages ─── */}
        {error && (
          <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 sm:mx-5">
            <ExclamationCircleIcon className="mr-2 inline-block h-4 w-4" />
            {error}
          </div>
        )}
        {actionError && (
          <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 sm:mx-5">
            <ExclamationCircleIcon className="mr-2 inline-block h-4 w-4" />
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 sm:mx-5">
            <CheckCircleIcon className="mr-2 inline-block h-4 w-4" />
            {actionSuccess}
          </div>
        )}

        {/* ─── UserIcon List ─── */}

        {isMobileView ? (
          <div className="divide-y divide-neutral-100">
            {loading ? (
              <div className="px-4 py-12 text-center sm:px-5">
                <ArrowPathIcon className="mx-auto animate-spin text-neutral-300 h-5 w-5" />
                <p className="mt-3 text-sm text-neutral-400">Chargement des utilisateurs…</p>
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="px-4 py-12 text-center sm:px-5">
                <UserIcon className="mx-auto text-neutral-200 h-7 w-7" />
                <p className="mt-3 text-sm font-medium text-neutral-500">Aucun utilisateur trouvé</p>
                <p className="mt-1 text-xs text-neutral-400">Essayez de modifier vos filtres</p>
              </div>
            ) : (
              paginatedUsers.map((user) => {
                const isBlocked = Boolean(user.isBlocked);
                const isInactive = user.isActive === false;
                const isShopAccount = user.accountType === 'shop';
                const hasShopLocation = Boolean(getLocationCoordinates(user.shopLocation));
                const shouldShowLocationPanel =
                  isShopAccount &&
                  (hasShopLocation ||
                    user.shopLocationNeedsReview ||
                    user.shopLocationReviewStatus === 'rejected' ||
                    (Array.isArray(user.shopLocationReviewFlags) && user.shopLocationReviewFlags.length > 0));
                return (
                  <article key={user.id} className="group px-4 py-3.5 transition hover:bg-neutral-50/50 sm:px-5">
                    {/* Top row: Avatar + Info + Status */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {resolveUserProfileImage(user) ? (
                          <img
                            src={resolveUserProfileImage(user)}
                            alt={user.name || 'Utilisateur'}
                            className="h-11 w-11 rounded-xl object-cover ring-1 ring-neutral-200"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-400 uppercase">
                            {String(user.name || 'U').charAt(0)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                          isBlocked ? 'bg-red-400' : isInactive ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-neutral-900">{user.name}</p>
                          {user.accountType === 'shop' && <VerifiedBadge verified={Boolean(user.shopVerified)} />}
                        </div>
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1 truncate text-xs text-neutral-500">
                            <PhoneIcon className="shrink-0 text-neutral-400 h-2.5 w-2.5" />
                            <span className="truncate">{user.phone}</span>
                            {user.phoneVerified ? (
                              <CheckCircleIcon className="shrink-0 text-emerald-500 h-2.5 w-2.5" />
                            ) : null}
                          </p>
                          <p className="flex items-center gap-1 truncate text-xs text-neutral-500">
                            <EnvelopeIcon className="shrink-0 text-neutral-400 h-2.5 w-2.5" />
                            {user.email ? (
                              <>
                                <span className="truncate">{user.email}</span>
                                {user.emailVerified ? (
                                  <CheckCircleIcon className="shrink-0 text-emerald-500 h-2.5 w-2.5" />
                                ) : (
                                  <span className="shrink-0 text-[10px] font-semibold text-amber-600">Non vérifié</span>
                                )}
                              </>
                            ) : (
                              <span className="italic text-neutral-400">Non ajouté</span>
                            )}
                          </p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${getRoleBadgeClass(user.role)}`}>
                            {formatRoleLabel(user.role)}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            isBlocked
                              ? 'bg-red-50 text-red-600'
                              : isInactive
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isBlocked
                              ? <><NoSymbolIcon className="h-2.5 w-2.5" />Suspendu</>
                              : isInactive
                                ? <><UserMinusIcon className="h-2.5 w-2.5" />Désactivé</>
                                : <><CheckCircleIcon className="h-2.5 w-2.5" />Actif</>}
                          </span>
                          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                            {accountTypeLabels[user.accountType] || user.accountType}
                          </span>
                        </div>
                        {user.accountType === 'shop' && user.shopName && (
                          <p className="mt-1 text-[11px] text-neutral-500">
                            <BuildingStorefrontIcon className="mr-1 inline-block text-neutral-400 h-2.5 w-2.5" />
                            {user.shopName}
                            <span className="mx-1 text-neutral-300">·</span>
                            {formatNumber(user.followersCount)} abonnés
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Block/LockClosedIcon details */}
                    {isBlocked && (
                      <div className="mt-2 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-[11px] text-red-700">
                        <p className="font-semibold">Compte suspendu</p>
                        <p className="mt-0.5 text-red-600">Depuis le {formatDate(user.blockedAt)}</p>
                        {user.blockedReason && <p className="text-red-500 italic">Motif : {user.blockedReason}</p>}
                      </div>
                    )}
                    {user.isLocked && (
                      <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
                        <p className="font-semibold">Compte verrouillé</p>
                        <p className="mt-0.5">{formatDate(user.lockedAt)}{user.lockReason ? ` · ${user.lockReason}` : ''}</p>
                      </div>
                    )}
                    {user.reactivationRequest?.status === 'pending' && (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-black text-emerald-900">
                          Demande de réactivation
                        </p>
                        {user.reactivationRequest.message && (
                          <p className="mt-1 text-[11px] leading-5 text-emerald-800">
                            {user.reactivationRequest.message}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] font-semibold text-emerald-700">
                          Reçue le {formatDateTime(user.reactivationRequest.requestedAt)}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleReactivationReview(user, 'approve')}
                            disabled={!canManageUsers || pendingUserId === user.id}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            Approuver
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReactivationReview(user, 'reject')}
                            disabled={!canManageUsers || pendingUserId === user.id}
                            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Active restrictions */}
                    {getActiveRestrictionsCount(user) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {RESTRICTION_TYPES.filter((rt) => user.restrictions?.[rt.key]?.isActive).map((rt) => {
                          const IconComponent = rt.icon;
                          return (
                            <span key={rt.key} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <IconComponent className="h-2.5 w-2.5" />
                              {rt.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      {isBlocked ? (
                        <button
                          type="button"
                          onClick={() => handleUnblock(user)}
                          disabled={!canLockAccounts || !canActOnTargetUser(user) || pendingUserId === user.id}
                          className="flex-1 rounded-lg border border-green-500 px-3 py-2 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          Réactiver
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBlock(user)}
                          disabled={!canLockAccounts || !canActOnTargetUser(user) || pendingUserId === user.id}
                          className="flex-1 rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Suspendre
                        </button>
                      )}
                      {/* Restrictions dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRestrictionMenuOpen(restrictionMenuOpen === user.id ? null : user.id)}
                          disabled={!canManageUsers}
                          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                            getActiveRestrictionsCount(user) > 0
                              ? 'border-amber-500 bg-amber-50 text-amber-600'
                              : 'border-neutral-300 text-neutral-600 hover:bg-amber-50'
                          }`}
                        >
                          <ShieldExclamationIcon className="h-3.5 w-3.5" />
                          {getActiveRestrictionsCount(user) > 0 && <span>{getActiveRestrictionsCount(user)}</span>}
                        </button>
                        {restrictionMenuOpen === user.id && (
                          <div className="absolute right-0 mt-1 w-48 rounded-lg border bg-white shadow-sm z-20">
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
                                  <IconComponent className={isActive ? 'text-red-500' : 'text-gray-400'} className="h-3.5 w-3.5" />
                                  <span className={isActive ? 'text-red-600 font-semibold' : 'text-gray-700'}>{rt.label}</span>
                                  {isActive && <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Actif</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* More actions dropdown — everything else (conversion, delivery, shop, GPS, security, stats) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setMoreMenuOpen(moreMenuOpen === user.id ? null : user.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                        >
                          <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                          Plus
                        </button>
                        {moreMenuOpen === user.id && (
                          <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">
                            {renderUserMenuItems(user, () => setMoreMenuOpen(null))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-100 text-sm">
              <thead>
                <tr className="bg-neutral-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Rôle</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Statut</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Chat</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <ArrowPathIcon className="mx-auto animate-spin text-neutral-300 h-5 w-5" />
                      <p className="mt-3 text-sm text-neutral-400">Chargement des utilisateurs…</p>
                    </td>
                  </tr>
                ) : displayedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <UserIcon className="mx-auto text-neutral-200 h-7 w-7" />
                      <p className="mt-3 text-sm font-medium text-neutral-500">Aucun utilisateur trouvé</p>
                      <p className="mt-1 text-xs text-neutral-400">Essayez de modifier vos filtres</p>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => {
                    const isBlocked = Boolean(user.isBlocked);
                    const isInactive = user.isActive === false;
                    const isShopAccount = user.accountType === 'shop';
                    const hasShopLocation = Boolean(getLocationCoordinates(user.shopLocation));
                    const shouldShowLocationPanel =
                      isShopAccount &&
                      (hasShopLocation ||
                        user.shopLocationNeedsReview ||
                        user.shopLocationReviewStatus === 'rejected' ||
                        (Array.isArray(user.shopLocationReviewFlags) && user.shopLocationReviewFlags.length > 0));
                    return (
                      <tr key={user.id} className="group transition hover:bg-neutral-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              {resolveUserProfileImage(user) ? (
                                <img
                                  src={resolveUserProfileImage(user)}
                                  alt={user.name || 'Utilisateur'}
                                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-neutral-200"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-sm font-bold text-neutral-400 uppercase">
                                  {String(user.name || 'U').charAt(0)}
                                </div>
                              )}
                              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                isBlocked ? 'bg-red-400' : isInactive ? 'bg-amber-400' : 'bg-emerald-400'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-neutral-900">{user.name}</span>
                                {user.accountType === 'shop' && <VerifiedBadge verified={Boolean(user.shopVerified)} />}
                              </div>
                              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                                {user.email ? (
                                  <>
                                    {user.email}
                                    {user.emailVerified ? (
                                      <CheckCircleIcon className="shrink-0 text-emerald-500 h-[11px] w-[11px]" />
                                    ) : (
                                      <span className="shrink-0 text-[10px] font-semibold text-amber-600">Non vérifié</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="italic text-neutral-400">Email non ajouté</span>
                                )}
                              </span>
                              <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-400">
                                {user.phone || '—'}
                                {user.phoneVerified ? (
                                  <CheckCircleIcon className="shrink-0 text-emerald-500 h-[11px] w-[11px]" />
                                ) : null}
                              </span>
                            {user.accountType === 'shop' && user.shopName ? (
                              <div className="text-xs text-gray-500 mt-1 space-y-1">
                                <span className="text-neutral-600 font-semibold">
                                  Boutique : {user.shopName}
                                </span>
                                <p>Abonnés : {formatNumber(user.followersCount)}</p>
                                <Link
                                  to={buildShopPath(user)}
                                  className="text-neutral-500 underline text-xs font-semibold"
                                >
                                  Voir la boutique
                                </Link>
                              </div>
                            ) : null}
                            {shouldShowLocationPanel ? (
                              <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1.5 text-[11px] text-sky-900">
                                <div className="flex items-center gap-2">
                                  <MapPinIcon className="text-sky-700 h-3 w-3" />
                                  <span className="font-semibold">
                                    {user.shopLocationNeedsReview
                                      ? 'GPS à valider'
                                      : user.shopLocationReviewStatus === 'rejected'
                                        ? 'GPS rejeté'
                                        : 'GPS validé'}
                                  </span>
                                </div>
                                <p className="mt-1">{formatCoordinates(user.shopLocation)}</p>
                                <p className="mt-0.5 text-sky-700">
                                  Score {Number.isFinite(Number(user.shopLocationTrustScore)) ? Math.round(Number(user.shopLocationTrustScore)) : 0}%
                                </p>
                              </div>
                            ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                              {accountTypeLabels[user.accountType] || user.accountType}
                            </span>
                            {user.accountType === 'shop' && (
                              <VerifiedBadge verified={Boolean(user.shopVerified)} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${getRoleBadgeClass(user.role)}`}>
                            {formatRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isBlocked ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                                <NoSymbolIcon className="h-3 w-3" />
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
                              {user.isLocked ? (
                                <span className="text-xs text-amber-700">
                                  Verrouillé {user.lockReason ? `· ${user.lockReason}` : ''}
                                </span>
                              ) : null}
                            </div>
                          ) : isInactive ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                <UserMinusIcon className="h-3 w-3" />
                                Désactivé
                              </span>
                              {user.deactivatedAt ? (
                                <span className="text-xs text-gray-500">
                                  Depuis le {formatDate(user.deactivatedAt)}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">
                              <CheckCircleIcon className="h-3 w-3" />
                              Actif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleChatTemplateAccess(user)}
                            disabled={!canManagePermissions || ['admin', 'founder'].includes(user.role) || togglingChatTemplateUserId === user.id}
                            className={`inline-flex min-w-[110px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                              user.canManageChatTemplates
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 border border-neutral-200'
                            }`}
                            title={
                              ['admin', 'founder'].includes(user.role)
                                ? 'Permission toujours active pour un administrateur/fondateur'
                                : 'Basculer l’accès à la gestion des templates chat'
                            }
                          >
                            {togglingChatTemplateUserId === user.id
                              ? 'Mise à jour...'
                              : user.canManageChatTemplates
                                ? 'Accès accordé'
                                : 'Accès retiré'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {user.reactivationRequest?.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReactivationReview(user, 'approve')}
                                  disabled={!canManageUsers || pendingUserId === user.id}
                                  title={user.reactivationRequest.message || 'Demande de réactivation'}
                                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
                                >
                                  Réactiver
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReactivationReview(user, 'reject')}
                                  disabled={!canManageUsers || pendingUserId === user.id}
                                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-black text-red-700 disabled:opacity-50"
                                >
                                  Refuser
                                </button>
                              </>
                            )}
                            {isBlocked ? (
                              <button
                                type="button"
                                onClick={() => handleUnblock(user)}
                                disabled={!canLockAccounts || !canActOnTargetUser(user) || pendingUserId === user.id}
                                className="rounded-lg border border-green-500 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                              >
                                Réactiver
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleBlock(user)}
                                disabled={!canLockAccounts || !canActOnTargetUser(user) || pendingUserId === user.id}
                                className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Suspendre
                              </button>
                            )}
                            {/* Restrictions dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setRestrictionMenuOpen(restrictionMenuOpen === user.id ? null : user.id)}
                                disabled={!canManageUsers}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold hover:bg-amber-50 ${
                                  getActiveRestrictionsCount(user) > 0 ? 'border-amber-500 text-amber-600 bg-amber-50' : 'border-gray-300 text-gray-600'
                                }`}
                                title="Restrictions"
                              >
                                <ShieldExclamationIcon className="h-3 w-3" />
                                {getActiveRestrictionsCount(user) > 0 && <span>{getActiveRestrictionsCount(user)}</span>}
                              </button>
                              {restrictionMenuOpen === user.id && (
                                <div className="absolute right-0 mt-1 w-52 rounded-lg border bg-white shadow-sm z-20">
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
                                        <IconComponent className={isActive ? 'text-red-500' : 'text-gray-400'} className="h-3.5 w-3.5" />
                                        <span className={isActive ? 'text-red-600 font-semibold' : 'text-gray-700'}>{rt.label}</span>
                                        {isActive && <span className="ml-auto text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Actif</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {/* More actions dropdown — everything else (conversion, delivery, shop, GPS, security, stats) */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setMoreMenuOpen(moreMenuOpen === user.id ? null : user.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                                title="Plus d'actions"
                              >
                                <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                              </button>
                              {moreMenuOpen === user.id && (
                                <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border bg-white py-1 shadow-lg">
                                  {renderUserMenuItems(user, () => setMoreMenuOpen(null))}
                                </div>
                              )}
                            </div>
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
            <p className="text-xs text-neutral-400">
              {rangeStart}-{rangeEnd} sur {displayedUsers.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                <ChevronDownIcon className="rotate-90 h-3.5 w-3.5" />
                Précédent
              </button>
              <span className="text-xs font-medium text-neutral-500 tabular-nums">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Suivant
                <ChevronDownIcon className="-rotate-90 h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Restriction Modal */}
      {restrictionModal.open && restrictionModal.user && (() => {
        const restrictionType = RESTRICTION_TYPES.find((rt) => rt.key === restrictionForm.type);
        const IconComponent = restrictionType?.icon || ShieldExclamationIcon;
        const isActive = restrictionForm.restricted;
        
        return (
          <BaseModal
            isOpen={restrictionModal.open}
            onClose={closeRestrictionModal}
            size="md"
            panelClassName="max-h-[90dvh] sm:max-w-lg p-0"
            ariaLabel="Gestion de restriction utilisateur"
          >
              {/* Header */}
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${isActive ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <IconComponent className={isActive ? 'text-red-600' : 'text-gray-500'} className="h-6 w-6" />
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
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status Toggle */}
                <div className="bg-gray-50 rounded-xl p-5 border-2 border-dashed border-gray-200">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`relative w-14 h-8 rounded-full transition-all duration-300 ${
                        isActive ? 'bg-red-500' : 'bg-gray-300'
                      }`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${
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
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                      <h4 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
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
                            className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-all"
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
                            className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200 transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1.5">Optionnel - Laissez vide pour une restriction permanente</p>
                        </div>
                      </div>
                    </div>

                    {/* Reason Section */}
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <label className="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <ShieldExclamationIcon className="text-amber-600 h-4 w-4" />
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
                    <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-neutral-100 rounded-lg">
                          <ShieldExclamationIcon className="text-neutral-600 h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-neutral-900 mb-1">Information importante</p>
                          <p className="text-xs text-neutral-700 leading-relaxed">
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
                    <CheckCircleIcon className="text-green-500 mx-auto mb-3 h-12 w-12" />
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
                      <ExclamationCircleIcon className="text-red-600 flex-shrink-0 mt-0.5 h-5 w-5" />
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
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {restrictionLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <ArrowPathIcon className="animate-spin h-4 w-4" />
                        Traitement...
                      </span>
                    ) : isActive ? (
                      <span className="flex items-center justify-center gap-2">
                        <NoSymbolIcon className="h-4 w-4" />
                        Appliquer la restriction
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircleIcon className="h-4 w-4" />
                        Désactiver la restriction
                      </span>
                    )}
                  </button>
                </div>
              </div>
          </BaseModal>
        );
      })()}

      {/* Received Orders Modal */}
      {ordersModal.open && ordersModal.user && (
        <BaseModal
          isOpen={ordersModal.open}
          onClose={closeOrdersModal}
          size="lg"
          panelClassName="max-h-[80dvh] sm:max-w-2xl p-0"
          ariaLabel="Commandes reçues utilisateur"
        >
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Commandes reçues</h3>
                <p className="text-xs text-gray-500">{ordersModal.user.shopName || ordersModal.user.name}</p>
              </div>
              <button type="button" onClick={closeOrdersModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
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
                              <p className="text-gray-500">x{item.quantity} · {formatCurrency(item.price)}</p>
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
        </BaseModal>
      )}

      {/* Shop Conversion Request Modal */}
      {conversionModal.open && conversionModal.user && conversionModal.request && (
        <BaseModal
          isOpen={conversionModal.open}
          onClose={closeConversionModal}
          size="xl"
          panelClassName="max-h-[90dvh] sm:max-w-3xl p-0"
          ariaLabel="Demande de conversion en boutique"
        >
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Demande de conversion en boutique</h3>
                <p className="text-xs text-gray-500">{conversionModal.user.name} ({conversionModal.user.email})</p>
              </div>
              <button type="button" onClick={closeConversionModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
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
                      <BuildingStorefrontIcon className="text-neutral-600 h-[18px] w-[18px]" />
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

                  <div className="rounded-xl bg-orange-50 p-4 space-y-3">
                    <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                      <PhotoIcon className="text-[#e85d00] h-[18px] w-[18px]" />
                      Justificatifs de la boutique (4 requis)
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        ['shopPaper', 'Papier officiel'],
                        ['shopInvoice', 'Facture au nom de la boutique'],
                        ['insidePhoto', 'Intérieur de la boutique'],
                        ['outsidePhoto', 'Extérieur de la boutique']
                      ].map(([key, label]) => {
                        const url = conversionModal.request.verificationDocuments?.[key];
                        return (
                          <a key={key} href={url || undefined} target={url ? '_blank' : undefined} rel="noreferrer" className={`overflow-hidden rounded-xl border bg-white ${url ? 'border-emerald-200' : 'border-red-200'}`}>
                            {url ? <img src={url} alt={label} className="h-32 w-full object-cover" /> : <div className="grid h-32 place-items-center text-xs font-bold text-red-600">Document manquant</div>}
                            <p className="p-2 text-xs font-black text-gray-800">{label}</p>
                          </a>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CurrencyDollarIcon className="text-neutral-600 h-[18px] w-[18px]" />
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
                          {formatCurrency(conversionModal.request.paymentAmount || 50000)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                          <CreditCardIcon className="h-3.5 w-3.5" />
                          Nom de la transaction
                        </label>
                        <p className="text-sm text-gray-900 mt-1">{conversionModal.request.transactionName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                          <HashtagIcon className="h-3.5 w-3.5" />
                          Numéro de transaction
                        </label>
                        <p className="text-sm text-gray-900 mt-1 font-mono">{conversionModal.request.transactionNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Proof */}
                  <div className="bg-green-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <PhotoIcon className="text-green-600 h-[18px] w-[18px]" />
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
                  disabled={!canManageSellers || conversionLoading}
                  className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircleIcon className="inline mr-1 h-4 w-4" />
                  Rejeter
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveConversion(conversionModal.request._id)}
                  disabled={!canManageSellers || conversionLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircleIcon className="inline mr-1 h-4 w-4" />
                  Approuver
                </button>
              </div>
            )}
        </BaseModal>
      )}

      {/* Shop Location Review Modal */}
      {locationReviewModal.open && locationReviewModal.user && (
        <BaseModal
          isOpen={locationReviewModal.open}
          onClose={closeLocationReviewModal}
          size="md"
          panelClassName="max-h-[85dvh] sm:max-w-lg p-0"
          ariaLabel="Validation localisation boutique"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {locationReviewModal.decision === 'reject'
                  ? 'Rejet de localisation'
                  : 'Approbation de localisation'}
              </h3>
              <p className="text-xs text-gray-500">
                {locationReviewModal.user.shopName || locationReviewModal.user.name}
              </p>
            </div>
            <button type="button" onClick={closeLocationReviewModal} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-4 overflow-y-auto p-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900">
              <p className="font-semibold">Position actuelle</p>
              <p className="mt-1">{formatCoordinates(locationReviewModal.user.shopLocation)}</p>
              <p className="mt-1 text-sky-700">
                Score confiance: {Math.round(Number(locationReviewModal.user.shopLocationTrustScore || 0))}%
              </p>
              {locationReviewModal.user.shopLocationUpdatedAt ? (
                <p className="mt-1 text-sky-700">
                  Dernière mise à jour: {formatDateTime(locationReviewModal.user.shopLocationUpdatedAt)}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <p>
                Action: <span className="font-semibold">
                  {locationReviewModal.decision === 'reject'
                    ? 'Rejeter la localisation'
                    : 'Approuver la localisation'}
                </span>
              </p>
            </div>
            {locationReviewModal.decision === 'reject' ? (
              <div className="space-y-2">
                <label htmlFor="location-review-reason" className="text-sm font-semibold text-gray-800">
                  Raison du rejet (obligatoire)
                </label>
                <textarea
                  id="location-review-reason"
                  value={locationReviewReason}
                  onChange={(event) => setLocationReviewReason(event.target.value)}
                  rows={4}
                  placeholder="Expliquez pourquoi la localisation doit être rejetée..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
                <p className="text-xs text-gray-500">Minimum 3 caractères.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="location-review-note" className="text-sm font-semibold text-gray-800">
                  Note interne (optionnel)
                </label>
                <textarea
                  id="location-review-note"
                  value={locationReviewReason}
                  onChange={(event) => setLocationReviewReason(event.target.value)}
                  rows={3}
                  placeholder="Commentaire interne (facultatif)..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <button
              type="button"
              onClick={closeLocationReviewModal}
              disabled={locationReviewLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submitLocationReview}
              disabled={locationReviewLoading}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                locationReviewModal.decision === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {locationReviewLoading
                ? 'Traitement...'
                : locationReviewModal.decision === 'reject'
                  ? 'Confirmer le rejet'
                  : 'Confirmer l’approbation'}
            </button>
          </div>
        </BaseModal>
      )}

      {/* Shop Location Timeline Modal */}
      {locationTimelineModal.open && locationTimelineModal.user && (
        <BaseModal
          isOpen={locationTimelineModal.open}
          onClose={closeLocationTimelineModal}
          size="lg"
          panelClassName="max-h-[85dvh] sm:max-w-3xl p-0"
          ariaLabel="Timeline localisation boutique"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Timeline localisation</h3>
              <p className="text-xs text-gray-500">
                {locationTimelineModal.user.shopName || locationTimelineModal.user.name}
              </p>
            </div>
            <button type="button" onClick={closeLocationTimelineModal} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            {locationTimelineLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Chargement du timeline...</p>
            ) : locationTimelineEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Aucun événement de localisation.</p>
            ) : (
              <div className="space-y-3">
                {locationTimelineEntries.map((entry) => {
                  const entryType = String(entry?.type || '');
                  const createdAt = formatDateTime(entry?.createdAt);
                  if (entryType === 'review_action') {
                    const reason = String(entry?.reason || entry?.details?.reason || '').trim();
                    const actorName = entry?.performedBy?.name || 'Admin';
                    return (
                      <div key={entry.id} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getActionColor(entry?.action)}`}>
                            {getActionLabel(entry?.action)}
                          </span>
                          <span className="text-xs text-gray-500">{createdAt}</span>
                        </div>
                        <p className="mt-2 text-xs text-indigo-900">
                          Par: <span className="font-semibold">{actorName}</span>
                        </p>
                        {reason ? (
                          <p className="mt-1 text-xs text-indigo-800">
                            Raison: <span className="italic">{reason}</span>
                          </p>
                        ) : null}
                      </div>
                    );
                  }

                  const coordinatesLabel = formatEntryCoordinates(entry?.coordinates);
                  const source = formatLocationSource(entry?.source);
                  return (
                    <div key={entry.id} className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                          {entryType === 'current_location' ? 'Position active' : 'Mise à jour GPS'}
                        </span>
                        <span className="text-xs text-gray-500">{createdAt}</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-sky-900">{coordinatesLabel}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-sky-700">
                        <span>Source: {source}</span>
                        {Number.isFinite(Number(entry?.accuracy)) ? (
                          <span>Précision: {Math.round(Number(entry.accuracy))}m</span>
                        ) : null}
                        {Number.isFinite(Number(entry?.trustScore)) ? (
                          <span>Score: {Math.round(Number(entry.trustScore))}%</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </BaseModal>
      )}

      {/* Audit Log Modal */}
      {auditModal.open && (auditModal.user || auditModal.mode === 'founder') && (
        <BaseModal
          isOpen={auditModal.open}
          onClose={closeAuditModal}
          size="lg"
          panelClassName="max-h-[80dvh] sm:max-w-2xl p-0"
          ariaLabel="Historique des actions"
        >
            <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {auditModal.mode === 'founder' ? 'Timeline global (Founder)' : 'Historique des actions'}
                </h3>
                {auditModal.mode === 'founder' ? (
                  <p className="text-xs text-gray-500">Journal global des actions sensibles</p>
                ) : (
                  <p className="text-xs text-gray-500">{auditModal.user.name} ({auditModal.user.email})</p>
                )}
              </div>
              <button type="button" onClick={closeAuditModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {auditModal.mode === 'founder' ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {FOUNDER_AUDIT_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFounderAuditFilterChange(option.value)}
                      disabled={auditLoading}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        auditFilter === option.value
                          ? 'bg-neutral-900 text-white'
                          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-60`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {auditLoading ? (
                <p className="text-sm text-gray-500 text-center py-8">Chargement...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id || log._id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                      {(() => {
                        const actionKey = log.action || log.actionType || '';
                        const details = log.details || {};
                        const previousValue = log.previousValue || {};
                        const nextValue = log.newValue || {};
                        const actor = log.performedBy || details.performedBy || null;
                        const targetUser = log.targetUser || null;
                        return (
                          <>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getActionColor(actionKey)}`}>
                            {getActionLabel(actionKey)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(log.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {actor && (
                          <p>
                            <span className="font-semibold">Par:</span> {actor.name} ({actor.email})
                          </p>
                        )}
                        {targetUser && (
                          <p>
                            <span className="font-semibold">Cible:</span> {targetUser.name} ({targetUser.email})
                          </p>
                        )}
                        {details?.restrictionType && (
                          <p>
                            <span className="font-semibold">Restriction:</span> {details.restrictionLabel || details.restrictionType}
                          </p>
                        )}
                        {(details?.reason || nextValue?.lockReason) && (
                          <p className="italic text-gray-500">
                            <span className="font-semibold not-italic">Raison:</span> {details.reason || nextValue.lockReason}
                          </p>
                        )}
                        {(details?.previousRole || previousValue?.role) && (
                          <p>
                            <span className="font-semibold">Rôle:</span> {details.previousRole || previousValue.role} → {details.newRole || nextValue.role}
                          </p>
                        )}
                        {details?.previousType && (
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
                        {(log.ipAddress || log.ip) && (
                          <p className="text-gray-400">
                            <span className="font-semibold">IP:</span> {log.ipAddress || log.ip}
                          </p>
                        )}
                        {log.device && (
                          <p className="text-gray-400">
                            <span className="font-semibold">Device:</span> {log.device}
                          </p>
                        )}
                      </div>
                          </>
                        );
                      })()}
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
        </BaseModal>
      )}

      {/* Click outside to close restriction menu */}
      {restrictionMenuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setRestrictionMenuOpen(null)} />
      )}
      {/* Click outside to close the "more actions" menu */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(null)} />
      )}
    </div>
  );
}
