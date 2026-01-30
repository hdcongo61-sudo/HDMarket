import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import api from '../services/api';
import VerifiedBadge from '../components/VerifiedBadge';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import {
  Paperclip,
  Users,
  Store,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  RefreshCw,
  Search,
  Filter,
  Eye,
  X,
  ChevronRight,
  Activity,
  ShoppingCart,
  MessageSquare,
  Shield,
  FileText,
  Calendar,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';

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

function SectionStatCard({ label, value, helper, icon: Icon }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/60 bg-gradient-to-br from-white to-gray-50/50 px-5 py-4 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-200/60">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {helper ? <p className="text-xs text-gray-500 mt-1">{helper}</p> : null}
        </div>
        {Icon && (
          <div className="ml-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 transition-transform duration-300 group-hover:scale-110">
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 transition-opacity duration-300 group-hover:from-indigo-500/5 group-hover:to-purple-500/5" />
    </div>
  );
}

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

function StatCard({ title, value, subtitle, highlight, icon: Icon, trend }) {
  const iconColors = highlight
    ? 'from-indigo-500 to-purple-600'
    : 'from-gray-400 to-gray-500';
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
      highlight
        ? 'border-indigo-200/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 shadow-md hover:shadow-lg'
        : 'border-gray-200/60 bg-gradient-to-br from-white to-gray-50/50 shadow-sm hover:shadow-md hover:border-indigo-200/40'
    }`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className={`text-sm font-semibold mb-1 ${highlight ? 'text-indigo-700' : 'text-gray-600'}`}>
              {title}
            </p>
            <p className={`text-3xl font-bold mb-1 ${highlight ? 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent' : 'text-gray-900'}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                {trend && (
                  <TrendingUp size={12} className={trend > 0 ? 'text-green-500' : 'text-red-500'} />
                )}
                {subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`ml-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${iconColors} text-white shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md`}>
              <Icon size={22} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 transition-opacity duration-300 group-hover:from-indigo-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5" />
      )}
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
  const [salesTrends, setSalesTrends] = useState(null);
  const [salesTrendsLoading, setSalesTrendsLoading] = useState(false);
  const [salesTrendsPeriod, setSalesTrendsPeriod] = useState(30);
  const [orderHeatmap, setOrderHeatmap] = useState(null);
  const [orderHeatmapLoading, setOrderHeatmapLoading] = useState(false);
  const [conversionMetrics, setConversionMetrics] = useState(null);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [cohortAnalysis, setCohortAnalysis] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);
  const [hourOrders, setHourOrders] = useState([]);
  const [hourOrdersLoading, setHourOrdersLoading] = useState(false);
  const [hourOrdersError, setHourOrdersError] = useState('');
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
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsError, setComplaintsError] = useState('');
  const [complaintsFilter, setComplaintsFilter] = useState('pending');
  const [complaintActionMessage, setComplaintActionMessage] = useState('');
  const [complaintActionError, setComplaintActionError] = useState('');
  const [complaintActioningId, setComplaintActioningId] = useState('');
  const [paymentActionMessage, setPaymentActionMessage] = useState('');
  const [paymentActionError, setPaymentActionError] = useState('');
  const [roleUpdatingId, setRoleUpdatingId] = useState('');
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth < 1024;
  });
  const [activeAdminTab, setActiveAdminTab] = useState('overview');
  const externalLinkProps = useDesktopExternalLink();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderOrders, setReminderOrders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState('');
  const [reminderActioningId, setReminderActioningId] = useState('');
  const { showToast } = useToast();

  const { user: authUser } = useContext(AuthContext);
  const isAdmin = authUser?.role === 'admin';
  const isManager = authUser?.role === 'manager';
  const canAccessBackOffice = isAdmin || isManager;
  const canViewStats = isAdmin;
  const canManageUsers = isAdmin;
  const canManagePayments = isAdmin || isManager;
  const canManageComplaints = isAdmin || isManager;
  const pageTitle = isManager ? 'Espace gestionnaire' : 'Tableau de bord administrateur';
  const pageSubtitle = isManager
    ? 'Validez les preuves de paiement et contrôlez la mise en ligne des annonces.'
    : 'Visualisez les indicateurs clés de la plateforme et gérez la validation des paiements.';
  const availableTabs = useMemo(() => {
    const tabs = [];
    if (canViewStats) tabs.push({ key: 'overview', label: 'Statistiques' });
    if (canManageUsers) tabs.push({ key: 'users', label: 'Utilisateurs' });
    if (canManagePayments) tabs.push({ key: 'payments', label: 'Paiements' });
    if (canManageComplaints) tabs.push({ key: 'complaints', label: 'Réclamations' });
    return tabs;
  }, [canViewStats, canManageUsers, canManagePayments, canManageComplaints]);

  const complaintStatusLabels = {
    pending: 'En attente',
    in_review: 'En cours',
    resolved: 'Résolue'
  };

  const complaintStatusStyles = {
    pending: 'bg-orange-100 text-orange-800',
    in_review: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800'
  };

  const complaintStatusFilterOptions = [
    { value: '', label: 'Toutes' },
    { value: 'pending', label: 'En attente' },
    { value: 'in_review', label: 'En cours' },
    { value: 'resolved', label: 'Résolues' }
  ];

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
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

  const loadSalesTrends = useCallback(async () => {
    setSalesTrendsLoading(true);
    try {
      const { data } = await api.get(`/admin/analytics/sales-trends?days=${salesTrendsPeriod}`);
      setSalesTrends(data);
    } catch (e) {
      console.error('Error loading sales trends:', e);
    } finally {
      setSalesTrendsLoading(false);
    }
  }, [salesTrendsPeriod]);

  const loadOrderHeatmap = useCallback(async () => {
    setOrderHeatmapLoading(true);
    try {
      const { data } = await api.get('/admin/analytics/order-heatmap');
      setOrderHeatmap(data);
    } catch (e) {
      console.error('Error loading order heatmap:', e);
    } finally {
      setOrderHeatmapLoading(false);
    }
  }, []);

  const loadConversionMetrics = useCallback(async () => {
    setConversionLoading(true);
    try {
      const { data } = await api.get('/admin/analytics/conversion');
      setConversionMetrics(data);
    } catch (e) {
      console.error('Error loading conversion metrics:', e);
    } finally {
      setConversionLoading(false);
    }
  }, []);

  const loadCohortAnalysis = useCallback(async () => {
    setCohortLoading(true);
    try {
      const { data } = await api.get('/admin/analytics/cohorts');
      setCohortAnalysis(data);
    } catch (e) {
      console.error('Error loading cohort analysis:', e);
    } finally {
      setCohortLoading(false);
    }
  }, []);

  const loadOrdersByHour = useCallback(async (hour) => {
    setHourOrdersLoading(true);
    setHourOrdersError('');
    try {
      const { data } = await api.get(`/admin/analytics/orders-by-hour?hour=${hour}`);
      setHourOrders(data.orders || []);
      setSelectedHour(hour);
    } catch (e) {
      setHourOrdersError(e.response?.data?.message || 'Erreur lors du chargement des commandes.');
      setHourOrders([]);
    } finally {
      setHourOrdersLoading(false);
    }
  }, []);

  const loadReminderOrders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError('');
    try {
      const [pendingRes, confirmedRes, deliveringRes] = await Promise.all([
        api.get('/orders/admin', { params: { status: 'pending', limit: 30 } }),
        api.get('/orders/admin', { params: { status: 'confirmed', limit: 30 } }),
        api.get('/orders/admin', { params: { status: 'delivering', limit: 30 } })
      ]);
      const pendingItems = Array.isArray(pendingRes.data)
        ? pendingRes.data
        : pendingRes.data?.items || [];
      const confirmedItems = Array.isArray(confirmedRes.data)
        ? confirmedRes.data
        : confirmedRes.data?.items || [];
      const deliveringItems = Array.isArray(deliveringRes.data)
        ? deliveringRes.data
        : deliveringRes.data?.items || [];
      const merged = [...pendingItems, ...confirmedItems, ...deliveringItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setReminderOrders(merged);
    } catch (error) {
      setRemindersError(
        error.response?.data?.message ||
          'Impossible de charger les commandes en attente de relance.'
      );
      setReminderOrders([]);
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  const handleSendReminder = useCallback(
    async (orderId) => {
      if (!orderId) return;
      setReminderActioningId(orderId);
      try {
        const { data } = await api.post(`/orders/admin/${orderId}/reminder`);
        showToast(data?.message || 'Rappel envoyé aux vendeurs.', { variant: 'success' });
      } catch (error) {
        const message =
          error.response?.data?.message || 'Impossible d\'envoyer le rappel.';
        showToast(message, { variant: 'error' });
      } finally {
        setReminderActioningId('');
      }
    },
    [showToast]
  );

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

  const loadComplaints = useCallback(async () => {
    if (!canManageComplaints) {
      setComplaints([]);
      return;
    }
    setComplaintsLoading(true);
    setComplaintsError('');
    try {
      const params = {};
      if (complaintsFilter) params.status = complaintsFilter;
      const { data } = await api.get('/admin/complaints', { params });
      const normalized = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            attachments: (Array.isArray(item.attachments) ? item.attachments : []).map((attachment) => ({
              ...attachment,
              url: normalizeUrl(attachment.path || attachment.url || '')
            }))
          }))
        : [];
      setComplaints(normalized);
    } catch (e) {
      setComplaintsError(
        e.response?.data?.message || e.message || 'Erreur lors du chargement des réclamations.'
      );
    } finally {
      setComplaintsLoading(false);
    }
  }, [canManageComplaints, complaintsFilter, normalizeUrl]);




  useEffect(() => {
    if (!canViewStats) return;
    loadStats();
    loadSalesTrends();
    loadOrderHeatmap();
    loadConversionMetrics();
    loadCohortAnalysis();
  }, [loadStats, loadSalesTrends, loadOrderHeatmap, loadConversionMetrics, loadCohortAnalysis, canViewStats]);

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
    if (canManageComplaints) return;
    setComplaints([]);
    setComplaintsLoading(false);
    setComplaintsError('');
  }, [canManageComplaints]);

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

  useEffect(() => {
    if (!canManageComplaints) return;
    loadComplaints();
  }, [loadComplaints, canManageComplaints]);

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

  const handleComplaintStatusChange = useCallback(
    async (complaintId, nextStatus) => {
      if (!complaintId || !nextStatus) return;
      setComplaintActionError('');
      setComplaintActionMessage('');
      setComplaintActioningId(complaintId);
      try {
        await api.patch(`/admin/complaints/${complaintId}/status`, { status: nextStatus });
        setComplaintActionMessage('Statut de la réclamation mis à jour.');
        showToast('Statut de la réclamation mis à jour.', { variant: 'success' });
        await loadComplaints();
      } catch (err) {
        const message =
          err.response?.data?.message || err.message || 'Impossible de mettre à jour le statut.';
        setComplaintActionError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setComplaintActioningId('');
      }
    },
    [loadComplaints, showToast]
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
  if (canManageComplaints) loadComplaints();
}, [
  loadStats,
  loadPayments,
  loadUsers,
  loadComplaints,
  canManagePayments,
  canManageUsers,
  canViewStats,
  canManageComplaints,
  canAccessBackOffice
]);

  useEffect(() => {
    if (!paymentActionMessage && !paymentActionError) return;
    const timer = setTimeout(() => {
      setPaymentActionMessage('');
      setPaymentActionError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [paymentActionMessage, paymentActionError]);

  useEffect(() => {
    if (!complaintActionMessage && !complaintActionError) return;
    const timer = setTimeout(() => {
      setComplaintActionMessage('');
      setComplaintActionError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [complaintActionMessage, complaintActionError]);

  useEffect(() => {
    if (!remindersOpen) return;
    loadReminderOrders();
  }, [remindersOpen, loadReminderOrders]);

  const totalUserCount = stats?.users?.total || 0;
  const totalProductCount = stats?.products?.total || 0;
  const orderStats = stats?.orders || {};
  const orderByStatus = orderStats.byStatus || {};
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

  const { overdueReminderOrders, regularReminderOrders } = useMemo(() => {
    if (!reminderOrders.length) {
      return { overdueReminderOrders: [], regularReminderOrders: [] };
    }
    const now = Date.now();
    const thresholdMs = 48 * 60 * 60 * 1000;
    const overdue = [];
    const regular = [];
    reminderOrders.forEach((order) => {
      if (order?.status === 'delivered') return;
      const createdAt = order?.createdAt ? new Date(order.createdAt).getTime() : 0;
      const isOverdue = createdAt && now - createdAt >= thresholdMs;
      if (isOverdue) {
        overdue.push(order);
      } else {
        regular.push(order);
      }
    });
    return { overdueReminderOrders: overdue, regularReminderOrders: regular };
  }, [reminderOrders]);

  const renderReminderOrderCard = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const statusLabel =
      order.status === 'pending'
        ? 'En attente'
        : order.status === 'confirmed'
        ? 'Confirmée'
        : order.status === 'delivering'
        ? 'En cours de livraison'
        : 'Livrée';
    const sellersMap = new Map();
    items.forEach((item) => {
      const shopId =
        item.snapshot?.shopId ||
        item.product?.user?._id ||
        item.product?.user ||
        '';
      const shopName =
        item.snapshot?.shopName ||
        item.product?.user?.shopName ||
        item.product?.user?.name ||
        'Boutique';
      const phone = item.product?.user?.phone || '';
      const key = shopId ? String(shopId) : shopName;
      if (sellersMap.has(key)) return;
      sellersMap.set(key, { name: shopName, phone });
    });
    const sellers = Array.from(sellersMap.values());

    return (
      <div
        key={order._id}
        className="rounded-2xl border border-gray-100 p-4 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Commande #{order._id.slice(-6)}
            </p>
            <p className="text-xs text-gray-500">
              {order.customer?.name || 'Client'} · {order.deliveryCity}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
            {statusLabel}
          </span>
        </div>
        {sellers.length > 0 && (
          <div className="text-xs text-gray-600 space-y-1">
            {sellers.map((seller) => (
              <p key={`${order._id}-${seller.name}`}>
                Vendeur: {seller.name}
                {seller.phone ? ` · ${seller.phone}` : ''}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSendReminder(order._id)}
            disabled={reminderActioningId === order._id}
            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            Rappel
          </button>
          <Link
            to="/admin/orders"
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Voir dans commandes
          </Link>
        </div>
      </div>
    );
  };

  const shouldShowSection = (key) => !isMobileView || activeAdminTab === key;

  const paymentFilterOptions = [
    { value: 'waiting', label: 'En attente' },
    { value: 'verified', label: 'Validés' },
    { value: 'rejected', label: 'Rejetés' },
    { value: 'disabled_products', label: 'Annonces désactivées' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b border-gray-200/60">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
              <Settings size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                {pageTitle}
              </h1>
              <p className="text-sm text-gray-600 mt-1">{pageSubtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <RefreshCw size={16} className="transition-transform duration-300 hover:rotate-180" />
            Actualiser
          </button>
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Settings size={16} />
            App Settings
          </Link>
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <BarChart3 size={16} />
            Produits & statistiques
          </Link>
        </div>
      </header>
      {isMobileView && availableTabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveAdminTab(tab.key)}
              className={`flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                activeAdminTab === tab.key
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {canViewStats && shouldShowSection('overview') && (
        <>
          <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
              <Activity size={20} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Vue d'ensemble</h2>
              {stats?.generatedAt && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Dernière mise à jour&nbsp;: {formatDateTime(stats.generatedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
        {statsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium text-red-800">{statsError}</p>
          </div>
        ) : null}
        {statsLoading && !stats ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-sm font-medium text-gray-600">Chargement des statistiques…</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Utilisateurs inscrits"
              value={formatNumber(stats?.users?.total)}
              subtitle={`${formatNumber(stats?.users?.newLast30Days)} nouveaux sur 30 jours`}
              icon={Users}
              trend={stats?.users?.newLast30Days > 0 ? 1 : -1}
            />
            <StatCard
              title="Boutiques actives"
              value={formatNumber(stats?.users?.shops)}
              subtitle={`${formatNumber(stats?.users?.admins)} administrateurs`}
              icon={Store}
            />
            <StatCard
              title="Annonces actives"
              value={formatNumber(stats?.products?.total)}
              subtitle={`${formatNumber(stats?.products?.approved)} publiées`}
              icon={Package}
            />
            <StatCard
              title="Annonces en attente"
              value={formatNumber(stats?.products?.pending)}
              subtitle={`${formatNumber(stats?.products?.rejected)} rejetées`}
              icon={Clock}
            />
            <StatCard
              title="Paiements en attente"
              value={formatNumber(stats?.payments?.waiting)}
              subtitle={`${formatNumber(stats?.payments?.verified)} validés`}
              icon={DollarSign}
            />
            <StatCard
              title="Commentaires"
              value={formatNumber(stats?.engagement?.comments)}
              subtitle={`${formatNumber(stats?.engagement?.ratings)} évaluations`}
              icon={MessageSquare}
            />
            <StatCard
              title="CA total"
              value={formatCurrency(stats?.payments?.revenue)}
              subtitle={`${formatCurrency(stats?.payments?.revenueLast30Days)} sur 30 jours`}
              highlight
              icon={TrendingUp}
              trend={stats?.payments?.revenueLast30Days > 0 ? 1 : -1}
            />
            <StatCard
              title="Favoris enregistrés"
              value={formatNumber(stats?.engagement?.favorites)}
              subtitle="Total cumulé"
              icon={ShoppingCart}
            />
          </div>
        )}
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100">
                  <ShoppingCart size={20} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Commandes globales</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Suivi des commandes et livraisons</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemindersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-100 hover:border-indigo-300"
              >
                <Clock size={16} />
                Relances commandes
              </button>
            </div>
            {statsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800">{statsError}</p>
              </div>
            ) : null}
            {statsLoading && !stats ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  <p className="text-sm font-medium text-gray-600">Chargement des statistiques…</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Commandes totales"
                  value={formatNumber(orderStats.total || 0)}
                  subtitle="Toutes les commandes"
                  icon={FileText}
                />
                <StatCard
                  title="En attente"
                  value={formatNumber(orderByStatus.pending?.count || 0)}
                  subtitle="À valider"
                  icon={Clock}
                />
                <StatCard
                  title="Confirmées"
                  value={formatNumber(orderByStatus.confirmed?.count || 0)}
                  subtitle="À préparer"
                  icon={CheckCircle}
                />
                <StatCard
                  title="En cours de livraison"
                  value={formatNumber(orderByStatus.delivering?.count || 0)}
                  subtitle="Expédiées"
                  icon={Package}
                />
                <StatCard
                  title="Livrées"
                  value={formatNumber(orderByStatus.delivered?.count || 0)}
                  subtitle="Terminées"
                  icon={CheckCircle}
                />
                <StatCard
                  title="Montant total"
                  value={formatCurrency(orderStats.totalAmount || 0)}
                  subtitle="Volume commandes"
                  highlight
                  icon={TrendingUp}
                />
                <StatCard
                  title="Acomptes encaissés"
                  value={formatCurrency(orderStats.paidAmount || 0)}
                  subtitle="Paiements reçus"
                  icon={DollarSign}
                />
                <StatCard
                  title="Reste à payer"
                  value={formatCurrency(orderStats.remainingAmount || 0)}
                  subtitle="Soldes ouverts"
                  icon={AlertCircle}
                />
              </div>
            )}
          </section>

          {remindersOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setRemindersOpen(false)}
              />
              <div
                className="relative w-full max-w-3xl rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Relances commandes</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Commandes en attente, confirmées &amp; en cours de livraison
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemindersOpen(false)}
                    className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    aria-label="Fermer"
                  >
                    X
                  </button>
                </div>

                {remindersLoading ? (
                  <p className="text-sm text-gray-500">Chargement des commandes…</p>
                ) : remindersError ? (
                  <p className="text-sm text-red-600">{remindersError}</p>
                ) : reminderOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucune commande à relancer.</p>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wide text-rose-600">
                          Commandes +48h non livrées
                        </p>
                        <span className="text-xs font-semibold text-rose-600">
                          {overdueReminderOrders.length}
                        </span>
                      </div>
                      {overdueReminderOrders.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Aucune commande en retard pour le moment.
                        </p>
                      ) : (
                        overdueReminderOrders.map(renderReminderOrderCard)
                      )}
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Autres commandes à relancer
                      </p>
                      {regularReminderOrders.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Aucune autre commande à relancer.
                        </p>
                      ) : (
                        regularReminderOrders.map(renderReminderOrderCard)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Charts Section */}
          {canViewStats && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
                  <BarChart3 size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Analytics en Temps Réel</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Graphiques interactifs et analyses détaillées de l'activité
                  </p>
                </div>
              </div>

              {/* Sales Trends Chart */}
              <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-gray-900">Tendances de Vente</h4>
                  <div className="flex gap-2">
                    {[7, 30, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => {
                          setSalesTrendsPeriod(days);
                          loadSalesTrends();
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          salesTrendsPeriod === days
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {days}j
                      </button>
                    ))}
                  </div>
                </div>
                {salesTrendsLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  </div>
                ) : salesTrends?.trends?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={salesTrends.trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name) => {
                          if (name === 'Revenus (FCFA)') {
                            return `${Number(value).toLocaleString('fr-FR')} FCFA`;
                          }
                          return value;
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="orders"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        name="Commandes"
                        dot={{ r: 4 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Revenus (FCFA)"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-12">Aucune donnée disponible</p>
                )}
              </div>

              {/* Order Heatmap */}
              <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900 mb-4">Heatmap des Heures de Pointe</h4>
                {orderHeatmapLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                  </div>
                ) : orderHeatmap?.heatmap?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={orderHeatmap.heatmap}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name) => {
                          if (name === 'Commandes') {
                            return [`${value} commandes`, name];
                          }
                          return [value, name];
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        name="Commandes" 
                        fill="#4f46e5" 
                        radius={[8, 8, 0, 0]}
                        onClick={(data) => {
                          if (data && typeof data.hour === 'number') {
                            loadOrdersByHour(data.hour);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {orderHeatmap.heatmap.map((entry, index) => {
                          const intensity = entry.count / Math.max(...orderHeatmap.heatmap.map((h) => h.count));
                          const isSelected = selectedHour === entry.hour;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isSelected 
                                ? `rgba(79, 70, 229, 1)` 
                                : `rgba(79, 70, 229, ${Math.max(0.3, intensity)})`
                              }
                              stroke={isSelected ? '#1e1b4b' : 'none'}
                              strokeWidth={isSelected ? 2 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-12">Aucune donnée disponible</p>
                )}
              </div>

              {/* Conversion Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">Métriques de Conversion</h4>
                  {conversionLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    </div>
                  ) : conversionMetrics ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                        <span className="text-sm text-gray-700">Visiteurs uniques</span>
                        <span className="text-lg font-bold text-indigo-600">
                          {conversionMetrics.metrics.uniqueVisitors.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-700">Clients uniques</span>
                        <span className="text-lg font-bold text-green-600">
                          {conversionMetrics.metrics.uniqueCustomers.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm text-gray-700">Taux de conversion</span>
                        <span className="text-lg font-bold text-purple-600">
                          {conversionMetrics.metrics.visitorToOrderRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm text-gray-700">Vues totales</span>
                        <span className="text-lg font-bold text-amber-600">
                          {conversionMetrics.metrics.totalViews.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>

                {/* Cohort Analysis */}
                <div className="rounded-2xl border border-gray-200/60 bg-white p-6 shadow-sm">
                  <h4 className="text-base font-semibold text-gray-900 mb-4">Analyse de Cohort</h4>
                  {cohortLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    </div>
                  ) : cohortAnalysis?.cohorts?.length ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cohortAnalysis.cohorts.slice(-6).map((cohort) => (
                        <div key={cohort.cohort} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900">{cohort.label}</span>
                            <span className="text-xs text-gray-500">
                              {cohort.retentionRate}% rétention
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>{cohort.totalUsers} utilisateurs</span>
                            <span>{cohort.activeUsers} actifs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Orders by Hour Modal */}
          {selectedHour !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => {
                  setSelectedHour(null);
                  setHourOrders([]);
                }}
              />
              <div
                className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-white shadow-xl border border-gray-100 p-6 flex flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Commandes par heure</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Commandes créées à {String(selectedHour).padStart(2, '0')}:00
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Derniers 30 jours · {hourOrders.length} commande{hourOrders.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHour(null);
                      setHourOrders([]);
                    }}
                    className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                  {hourOrdersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    </div>
                  ) : hourOrdersError ? (
                    <p className="text-sm text-red-600 text-center py-8">{hourOrdersError}</p>
                  ) : hourOrders.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-12">Aucune commande trouvée pour cette heure.</p>
                  ) : (
                    <div className="space-y-4">
                      {hourOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900">
                                  {order.customer?.name || 'Client inconnu'}
                                </span>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    order.status === 'delivered'
                                      ? 'bg-green-100 text-green-800'
                                      : order.status === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : order.status === 'delivering'
                                      ? 'bg-blue-100 text-blue-800'
                                      : order.status === 'confirmed'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {order.status === 'pending'
                                    ? 'En attente'
                                    : order.status === 'confirmed'
                                    ? 'Confirmée'
                                    : order.status === 'delivering'
                                    ? 'En livraison'
                                    : order.status === 'delivered'
                                    ? 'Livrée'
                                    : 'Annulée'}
                                </span>
                              </div>
                              {order.customer?.email && (
                                <p className="text-xs text-gray-600">{order.customer.email}</p>
                              )}
                              {order.customer?.phone && (
                                <p className="text-xs text-gray-600">{order.customer.phone}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {formatCurrency(order.totalAmount || 0)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                          </div>

                          {order.items?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Articles:</p>
                              <div className="space-y-1">
                                {order.items.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700">
                                      {item.product?.title || item.snapshot?.title || 'Produit'} × {item.quantity || 1}
                                    </span>
                                    {item.product?.price && (
                                      <span className="text-gray-600">
                                        {formatCurrency(item.product.price * (item.quantity || 1))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {order.items.length > 3 && (
                                  <p className="text-xs text-gray-500">
                                    +{order.items.length - 3} autre{order.items.length - 3 > 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {order.deliveryAddress && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-600">
                                <MapPin size={12} className="inline mr-1" />
                                {order.deliveryAddress}
                                {order.deliveryCity && `, ${order.deliveryCity}`}
                              </p>
                            </div>
                          )}

                          {order.deliveryCode && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-indigo-600">
                                Code: {order.deliveryCode}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SectionStatCard
              label="Utilisateurs"
              value={formatNumber(stats?.users?.total)}
              helper={`Boutiques : ${formatNumber(stats?.users?.shops)}`}
            />
            <SectionStatCard
              label="Utilisateurs bloqués"
              value={formatNumber(stats?.users?.blocked || 0)}
              helper="À surveiller"
            />
            <SectionStatCard
              label="Nouveaux (30j)"
              value={formatNumber(stats?.users?.newLast30Days)}
              helper="Indicateur 30 jours"
            />
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
                      <Link
                        to={`/admin/users/${user.id}/stats`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Voir ses statistiques →
                      </Link>
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
                        <Link
                          to={`/admin/users/${user.id}/stats`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Voir ses statistiques →
                        </Link>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SectionStatCard
              label="En attente"
              value={formatNumber(stats?.payments?.waiting)}
              helper="Paiements non vérifiés"
            />
            <SectionStatCard
              label="Validés"
              value={formatNumber(stats?.payments?.verified)}
              helper="Paiements acceptés"
            />
            <SectionStatCard
              label="CA validé"
              value={formatCurrency(stats?.payments?.revenue)}
              helper="Total confirmé"
            />
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
                      to={buildProductPath(p.product)}
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
                          to={buildProductPath(p.product)}
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

      {canManageComplaints && shouldShowSection('complaints') && (
        <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Réclamations</h2>
              <p className="text-xs text-gray-500">
                Consultez les plaintes déposées par les utilisateurs et attribuez un statut adapté.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <select
                value={complaintsFilter}
                onChange={(e) => setComplaintsFilter(e.target.value)}
                className="rounded border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {complaintStatusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadComplaints}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Actualiser
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SectionStatCard
              label="Total"
              value={formatNumber(complaints.length)}
              helper="Réclamations enregistrées"
            />
            <SectionStatCard
              label="En attente"
              value={formatNumber(complaints.filter((item) => item.status === 'pending').length)}
              helper="Nouveau et non traité"
            />
            <SectionStatCard
              label="Résolues"
              value={formatNumber(complaints.filter((item) => item.status === 'resolved').length)}
              helper="Confirmées"
            />
          </div>

          {(complaintActionMessage || complaintActionError) && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                complaintActionError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}
            >
              {complaintActionError || complaintActionMessage}
            </div>
          )}

          {complaintsLoading ? (
            <p className="text-sm text-gray-500">Chargement des réclamations…</p>
          ) : complaintsError ? (
            <p className="text-sm text-red-600">{complaintsError}</p>
          ) : (
            <ul className="space-y-4">
              {complaints.length ? (
                complaints.map((complaint) => (
                  <li key={complaint._id} className="space-y-3 rounded-2xl border border-gray-100 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {complaint.subject || 'Sans objet'}
                        </p>
                      <p className="text-xs text-gray-500 flex flex-wrap gap-2">
                        <span>
                          {complaint.user?.name || 'Utilisateur anonyme'}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {complaint.user?.email || 'Email introuvable'}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {complaint.user?.phone || 'Téléphone non renseigné'}
                        </span>
                      </p>
                        <p className="text-xs text-gray-400">{formatDateTime(complaint.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            complaintStatusStyles[complaint.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {complaintStatusLabels[complaint.status] || complaint.status}
                        </span>
                        <select
                          value={complaint.status}
                          onChange={(e) =>
                            handleComplaintStatusChange(complaint._id, e.target.value)
                          }
                          disabled={complaintActioningId === complaint._id}
                          className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {Object.keys(complaintStatusLabels).map((statusKey) => (
                            <option key={statusKey} value={statusKey}>
                              {complaintStatusLabels[statusKey]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line break-words">
                      {complaint.message}
                    </p>
                    {complaint.attachments?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {complaint.attachments
                          .filter((attachment) => attachment.url)
                          .map((attachment, index) => (
                            <a
                              key={`${attachment.filename}-${index}`}
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:border-rose-200"
                            >
                              <Paperclip className="w-3 h-3" />
                              {attachment.originalName || attachment.filename}
                            </a>
                          ))}
                      </div>
                    ) : null}
                    {complaint.adminNote ? (
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">Note admin :</span>{' '}
                        {complaint.adminNote}
                      </p>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500">Aucune réclamation pour ce filtre.</li>
              )}
            </ul>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
