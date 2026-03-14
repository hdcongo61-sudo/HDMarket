import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
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
import { resolveUserProfileImage } from '../utils/userAvatar';
import GlassCard from '../components/ui/GlassCard';
import SoftColorCard from '../components/ui/SoftColorCard';
import FloatingGlassButton from '../components/ui/FloatingGlassButton';
import BaseModal, { ModalBody, ModalHeader } from '../components/modals/BaseModal';
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
  Mail,
  Wifi,
  Smartphone,
  Tablet,
  Monitor,
  Crown,
  ArrowUpRight
} from 'lucide-react';

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatCurrency = (value) => formatPriceWithStoredSettings(value);
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
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
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

function SectionStatCard({ label, value, helper, icon: Icon, variant = 'blue' }) {
  return (
    <SoftColorCard variant={variant} className="group relative overflow-hidden px-5 py-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-200">{label}</p>
          <p className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-200">{helper}</p> : null}
        </div>
        {Icon && (
          <div className="glass-card ml-3 flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition-transform duration-300 group-hover:scale-110 dark:text-slate-100">
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-white/0 transition-opacity duration-300 group-hover:bg-white/5 dark:group-hover:bg-black/10" />
    </SoftColorCard>
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

const ORDER_STATUS_LABELS = {
  pending_payment: 'Paiement',
  paid: 'Payées',
  ready_for_pickup: 'Prêtes au retrait',
  picked_up_confirmed: 'Retraits confirmés',
  ready_for_delivery: 'Prêtes à livrer',
  out_for_delivery: 'En livraison',
  delivery_proof_submitted: 'Preuve soumise',
  confirmed_by_client: 'Confirmées client',
  pending: 'En attente',
  pending_installment: 'Vente à confirmer',
  installment_active: 'Tranches actives',
  overdue_installment: 'Tranches en retard',
  dispute_opened: 'Litige ouvert',
  confirmed: 'Confirmées',
  delivering: 'En livraison',
  delivered: 'Livrées',
  completed: 'Paiement terminé',
  cancelled: 'Annulées'
};

const REMINDER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes actives' },
  { value: 'pending_payment', label: 'Paiement' },
  { value: 'paid', label: 'Payées' },
  { value: 'ready_for_pickup', label: 'Prêtes au retrait' },
  { value: 'picked_up_confirmed', label: 'Retraits confirmés' },
  { value: 'ready_for_delivery', label: 'Prêtes à livrer' },
  { value: 'out_for_delivery', label: 'En livraison' },
  { value: 'delivery_proof_submitted', label: 'Preuve soumise' },
  { value: 'confirmed_by_client', label: 'Confirmées client' },
  { value: 'pending', label: 'En attente' },
  { value: 'pending_installment', label: 'Vente à confirmer' },
  { value: 'installment_active', label: 'Tranches actives' },
  { value: 'overdue_installment', label: 'Tranches en retard' },
  { value: 'dispute_opened', label: 'Litige ouvert' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'delivering', label: 'En livraison' }
];

const REMINDER_PAYMENT_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Paiement (tous)' },
  { value: 'full', label: 'Comptant' },
  { value: 'installment', label: 'Paiement par tranche' }
];

const REMINDER_DELIVERY_MODE_FILTER_OPTIONS = [
  { value: '', label: 'Mode livraison (tous)' },
  { value: 'DELIVERY', label: 'Livraison' },
  { value: 'PICKUP', label: 'Récupérer en boutique' }
];

const ORDER_STATUS_SUMMARY_OPTIONS = [
  { value: 'pending_payment', label: 'Paiement' },
  { value: 'paid', label: 'Payées' },
  { value: 'ready_for_pickup', label: 'Prêtes au retrait' },
  { value: 'picked_up_confirmed', label: 'Retraits confirmés' },
  { value: 'ready_for_delivery', label: 'Prêtes à livrer' },
  { value: 'out_for_delivery', label: 'En livraison' },
  { value: 'delivery_proof_submitted', label: 'Preuve soumise' },
  { value: 'confirmed_by_client', label: 'Confirmées client' },
  { value: 'pending', label: 'En attente' },
  { value: 'pending_installment', label: 'Vente à confirmer' },
  { value: 'installment_active', label: 'Tranches actives' },
  { value: 'overdue_installment', label: 'Tranches en retard' },
  { value: 'dispute_opened', label: 'Litige ouvert' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'delivering', label: 'En livraison (legacy)' },
  { value: 'delivered', label: 'Livrées' },
  { value: 'completed', label: 'Paiement terminé' },
  { value: 'cancelled', label: 'Annulées' }
];

const REMINDER_FINAL_STATUSES = new Set(['delivered', 'completed', 'cancelled', 'confirmed_by_client', 'picked_up_confirmed']);

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
const REALTIME_WINDOW_OPTIONS = [
  { value: 15, label: '15m' },
  { value: 60, label: '60m' },
  { value: 180, label: '180m' }
];

function StatCard({ title, value, subtitle, highlight, icon: Icon, trend }) {
  return (
    <GlassCard
      variant={highlight ? 'green' : 'glass'}
      interactive
      className="group relative overflow-hidden p-5 glass-fade-in"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {title}
          </p>
          <p className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              {trend && (
                <TrendingUp size={12} className={trend > 0 ? 'text-green-500' : 'text-red-500'} />
              )}
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className="glass-card ml-3 flex h-12 w-12 items-center justify-center rounded-xl text-slate-700 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md dark:text-white">
            <Icon size={22} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-white/0 transition-opacity duration-300 group-hover:bg-white/5 dark:group-hover:bg-black/10" />
    </GlassCard>
  );
}

function AdminQuickKpiCard({ label, value, helper, icon: Icon, tone = 'slate' }) {
  const toneClasses = {
    blue: 'bg-blue-500/10 border-blue-200 text-blue-900 dark:border-blue-900/70 dark:bg-blue-500/20 dark:text-blue-100',
    green:
      'bg-emerald-500/10 border-emerald-200 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-500/20 dark:text-emerald-100',
    purple:
      'bg-purple-500/10 border-purple-200 text-purple-900 dark:border-purple-900/70 dark:bg-purple-500/20 dark:text-purple-100',
    orange:
      'bg-orange-500/10 border-orange-200 text-orange-900 dark:border-orange-900/70 dark:bg-orange-500/20 dark:text-orange-100',
    slate: 'bg-slate-500/10 border-slate-200 text-slate-900 dark:border-slate-700 dark:bg-slate-500/20 dark:text-slate-100'
  };
  const colorClass = toneClasses[tone] || toneClasses.slate;

  return (
    <article className={`rounded-2xl border p-3 shadow-sm ${colorClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-xl font-bold leading-none">{value}</p>
          {helper ? <p className="mt-1 text-xs opacity-80">{helper}</p> : null}
        </div>
        {Icon ? (
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-slate-900/60">
            <Icon size={18} />
          </span>
        ) : null}
      </div>
    </article>
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
  const [founderMini, setFounderMini] = useState(null);
  const [founderMiniLoading, setFounderMiniLoading] = useState(false);
  const [founderMiniError, setFounderMiniError] = useState('');
  const [onlineStats, setOnlineStats] = useState(null);
  const [onlineStatsLoading, setOnlineStatsLoading] = useState(false);
  const [realtimeMonitoring, setRealtimeMonitoring] = useState(null);
  const [realtimeMonitoringLoading, setRealtimeMonitoringLoading] = useState(false);
  const [realtimeMonitoringError, setRealtimeMonitoringError] = useState('');
  const [realtimeWindowMinutes, setRealtimeWindowMinutes] = useState(60);
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheStatsLoading, setCacheStatsLoading] = useState(false);
  const [cacheStatsError, setCacheStatsError] = useState('');
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
  const [reminderStatusFilter, setReminderStatusFilter] = useState('all');
  const [reminderPaymentTypeFilter, setReminderPaymentTypeFilter] = useState('');
  const [reminderDeliveryModeFilter, setReminderDeliveryModeFilter] = useState('');
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState('');
  const [reminderActioningId, setReminderActioningId] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState('');
  const [exportTarget, setExportTarget] = useState('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  const { user: authUser } = useContext(AuthContext);
  const normalizedRole = String(authUser?.role || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin';
  const isManager = normalizedRole === 'manager';
  const isFounder = normalizedRole === 'founder';
  const canAccessBackOffice = isAdmin || isManager || isFounder;
  const canViewStats = canAccessBackOffice;
  const canManageUsers = isAdmin || isFounder;
  const canManagePayments = isAdmin || isManager || isFounder;
  const canManageComplaints = isAdmin || isManager || isFounder;
  const pageTitle = isFounder
    ? 'Founder command center'
    : isManager
    ? 'Espace gestionnaire'
    : 'Tableau de bord administrateur';
  const pageSubtitle = isFounder
    ? 'Vue exécutive temps réel et intelligence croissance.'
    : isManager
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
  const adminTabMeta = useMemo(
    () => ({
      overview: { icon: Activity, helper: 'Vue globale' },
      users: { icon: Users, helper: 'Comptes & roles' },
      payments: { icon: DollarSign, helper: 'Validations' },
      complaints: { icon: AlertCircle, helper: 'Support & litiges' }
    }),
    []
  );

  const complaintStatusLabels = {
    pending: 'En attente',
    in_review: 'En cours',
    resolved: 'Résolue'
  };

  const complaintStatusStyles = {
    pending: 'bg-orange-100 text-orange-800',
    in_review: 'bg-neutral-100 text-neutral-800',
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

  const loadCacheStats = useCallback(async () => {
    setCacheStatsLoading(true);
    try {
      const { data } = await api.get('/admin/cache/stats');
      setCacheStats(data);
      setCacheStatsError('');
    } catch (e) {
      setCacheStatsError(
        e.response?.data?.message || e.message || 'Erreur lors du chargement des métriques cache.'
      );
    } finally {
      setCacheStatsLoading(false);
    }
  }, []);

  const loadOnlineStats = useCallback(async () => {
    setOnlineStatsLoading(true);
    try {
      const { data } = await api.get('/admin/online-stats');
      setOnlineStats(data || null);
    } catch {
      // Keep previous online snapshot on transient failures.
    } finally {
      setOnlineStatsLoading(false);
    }
  }, []);

  const loadRealtimeMonitoring = useCallback(async () => {
    setRealtimeMonitoringLoading(true);
    try {
      const { data } = await api.get('/admin/realtime-monitoring', {
        params: {
          windowMinutes: realtimeWindowMinutes,
          topLimit: 6,
          recentLimit: 12
        }
      });
      setRealtimeMonitoring(data || null);
      setRealtimeMonitoringError('');
    } catch (e) {
      setRealtimeMonitoringError(
        e?.response?.data?.message ||
          e?.message ||
          'Impossible de charger le monitoring temps réel.'
      );
    } finally {
      setRealtimeMonitoringLoading(false);
    }
  }, [realtimeWindowMinutes]);

  const loadFounderMini = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!isFounder) return;
    setFounderMiniLoading(true);
    try {
      const { data } = await api.get('/founder/intelligence', {
        params: forceRefresh ? { refresh: 'true' } : undefined
      });
      setFounderMini(data || null);
      setFounderMiniError('');
    } catch (e) {
      setFounderMiniError(
        e.response?.data?.message || e.message || 'Impossible de charger la synthèse founder.'
      );
    } finally {
      setFounderMiniLoading(false);
    }
  }, [isFounder]);

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
      const params = {
        limit: 120
      };
      if (reminderStatusFilter !== 'all') {
        params.status = reminderStatusFilter;
      }
      if (reminderPaymentTypeFilter) {
        params.paymentType = reminderPaymentTypeFilter;
      }
      if (reminderDeliveryModeFilter) {
        params.deliveryMode = reminderDeliveryModeFilter;
      }

      const { data } = await api.get('/orders/admin', { params });
      const items = Array.isArray(data) ? data : data?.items || [];
      const deduped = Array.from(
        new Map(
          items
            .filter((order) => order && order._id)
            .map((order) => [String(order._id), order])
        ).values()
      );
      const merged = deduped
        .filter((order) => !REMINDER_FINAL_STATUSES.has(String(order?.status || '')))
        .sort(
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
  }, [reminderStatusFilter, reminderPaymentTypeFilter, reminderDeliveryModeFilter]);

  const resetReminderFilters = useCallback(() => {
    setReminderStatusFilter('all');
    setReminderPaymentTypeFilter('');
    setReminderDeliveryModeFilter('');
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

  const sendBroadcast = useCallback(async () => {
    const msg = broadcastMessage.trim();
    if (!msg) {
      setBroadcastError('Veuillez saisir un message.');
      return;
    }
    setBroadcastSending(true);
    setBroadcastError('');
    setBroadcastSuccess('');
    try {
      const { data } = await api.post('/admin/notifications/broadcast', {
        message: msg,
        title: broadcastTitle.trim() || undefined,
        target: broadcastTarget
      });
      setBroadcastSuccess(data?.message || `Envoyé à ${data?.sent ?? 0} utilisateur(s).`);
      setBroadcastMessage('');
      setBroadcastTitle('');
      showToast(data?.message || 'Notification envoyée', { variant: 'success' });
    } catch (e) {
      const err = e.response?.data?.message || e.message || 'Erreur lors de l\'envoi.';
      setBroadcastError(err);
      showToast(err, { variant: 'error' });
    } finally {
      setBroadcastSending(false);
    }
  }, [broadcastMessage, broadcastTitle, broadcastTarget, showToast]);

  const handleExportPhones = useCallback(async () => {
    setExportLoading(true);
    setExportError('');
    try {
      const { data } = await api.get('/admin/users/export-phones', { params: { target: exportTarget } });
      const users = data?.users || [];
      if (!users.length) {
        setExportError('Aucun numéro à exporter pour ce filtre.');
        return;
      }
      const headers = ['Téléphone', 'Nom', 'Email', 'Type compte'];
      const rows = users.map((u) => [u.phone || '', u.name || '', u.email || '', u.accountType === 'shop' ? 'Boutique' : 'Particulier']);
      const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `numeros_${exportTarget}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${users.length} numéro(s) exporté(s)`, { variant: 'success' });
    } catch (e) {
      const err = e.response?.data?.message || e.message || 'Erreur lors de l\'export.';
      setExportError(err);
      showToast(err, { variant: 'error' });
    } finally {
      setExportLoading(false);
    }
  }, [exportTarget, showToast]);

  useEffect(() => {
    if (!canViewStats) return;
    loadStats();
    loadOnlineStats();
    loadRealtimeMonitoring();
    loadCacheStats();
    loadSalesTrends();
    loadOrderHeatmap();
    loadConversionMetrics();
    loadCohortAnalysis();
  }, [
    loadStats,
    loadOnlineStats,
    loadRealtimeMonitoring,
    loadCacheStats,
    loadSalesTrends,
    loadOrderHeatmap,
    loadConversionMetrics,
    loadCohortAnalysis,
    canViewStats
  ]);

  useEffect(() => {
    if (!isFounder) return undefined;
    loadFounderMini();
    const timer = setInterval(() => {
      loadFounderMini();
    }, 5000);
    return () => clearInterval(timer);
  }, [isFounder, loadFounderMini]);

  useEffect(() => {
    if (!canViewStats) return undefined;
    const timer = setInterval(() => {
      loadOnlineStats();
      loadRealtimeMonitoring();
    }, 5000);
    return () => clearInterval(timer);
  }, [canViewStats, loadOnlineStats, loadRealtimeMonitoring]);

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

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks = [];
      if (canViewStats) {
        tasks.push(
          loadStats(),
          loadOnlineStats(),
          loadRealtimeMonitoring(),
          loadCacheStats(),
          loadSalesTrends(),
          loadOrderHeatmap(),
          loadConversionMetrics(),
          loadCohortAnalysis()
        );
      }
      if (canManagePayments) tasks.push(loadPayments());
      if (canManageUsers) tasks.push(loadUsers());
      if (canManageComplaints) tasks.push(loadComplaints());
      if (isFounder) tasks.push(loadFounderMini({ forceRefresh: true }));
      tasks.push(loadReminderOrders());
      await Promise.all(tasks);
      showToast('Données actualisées.', { variant: 'success' });
    } catch (e) {
      showToast(e?.message || 'Erreur lors de l’actualisation.', { variant: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [
    loadStats,
    loadOnlineStats,
    loadRealtimeMonitoring,
    loadCacheStats,
    loadSalesTrends,
    loadOrderHeatmap,
    loadConversionMetrics,
    loadCohortAnalysis,
    loadPayments,
    loadUsers,
    loadComplaints,
    loadReminderOrders,
    canManagePayments,
    canManageUsers,
    canViewStats,
    canManageComplaints,
    isFounder,
    loadFounderMini,
    showToast
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
  const pendingComplaintsCount = complaints.filter((item) => item?.status === 'pending').length;
  const deviceDistribution = onlineStats?.deviceDistribution || {};
  const deviceCounts = {
    mobile: Number(deviceDistribution?.mobile || 0),
    tablet: Number(deviceDistribution?.tablet || 0),
    desktop: Number(deviceDistribution?.desktop || 0)
  };
  const totalDeviceSessions =
    deviceCounts.mobile + deviceCounts.tablet + deviceCounts.desktop;
  const deviceStatsCards = [
    {
      key: 'mobile',
      label: 'Mobile',
      count: deviceCounts.mobile,
      percent: formatPercent(deviceCounts.mobile, totalDeviceSessions),
      icon: Smartphone,
      color: 'bg-blue-500'
    },
    {
      key: 'tablet',
      label: 'iPad / Tablette',
      count: deviceCounts.tablet,
      percent: formatPercent(deviceCounts.tablet, totalDeviceSessions),
      icon: Tablet,
      color: 'bg-emerald-500'
    },
    {
      key: 'desktop',
      label: 'PC',
      count: deviceCounts.desktop,
      percent: formatPercent(deviceCounts.desktop, totalDeviceSessions),
      icon: Monitor,
      color: 'bg-violet-500'
    }
  ];
  const totalProductCount = stats?.products?.total || 0;
  const realtimeTopPages = Array.isArray(realtimeMonitoring?.topPages)
    ? realtimeMonitoring.topPages
    : [];
  const realtimeRecentEvents = Array.isArray(realtimeMonitoring?.recentEvents)
    ? realtimeMonitoring.recentEvents
    : [];
  const realtimeTotals = realtimeMonitoring?.totals || {
    pageViews: 0,
    likes: 0,
    comments: 0,
    uniqueVisitors: 0
  };
  const orderStats = stats?.orders || {};
  const orderByStatus = orderStats.byStatus || {};
  const orderStatusCount = (...statuses) =>
    statuses.reduce((sum, status) => sum + Number(orderByStatus?.[status]?.count || 0), 0);
  const cityStats = Array.isArray(stats?.demographics?.cities) ? stats.demographics.cities : [];
  const genderStats = Array.isArray(stats?.demographics?.genders) ? stats.demographics.genders : [];
  const productCityStats = Array.isArray(stats?.demographics?.productCities)
    ? stats.demographics.productCities
    : [];
  const productGenderStats = Array.isArray(stats?.demographics?.productGenders)
    ? stats.demographics.productGenders
    : [];
  const cacheHitRatio = Number(cacheStats?.hitRatio || 0);
  const cacheHits = Number(cacheStats?.hits || 0);
  const cacheReads = Number(cacheStats?.totalReads || 0);
  const cacheErrors = Number(cacheStats?.errors || 0);
  const cacheHistory = useMemo(() => {
    const list = Array.isArray(cacheStats?.history) ? cacheStats.history : [];
    return list.map((item) => ({
      label: item?.timestamp
        ? new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '',
      hitRatio: Number(item?.hitRatio || 0),
      misses: Number(item?.misses || 0)
    }));
  }, [cacheStats]);
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
  const heroQuickKpis = [
    {
      key: 'live',
      label: 'Actifs maintenant',
      value: formatNumber(onlineStats?.totalOnline),
      helper: onlineStatsLoading
        ? 'Synchronisation...'
        : `DAU ${formatNumber(onlineStats?.dau)} · Pic ${formatNumber(onlineStats?.peakToday)}`,
      icon: Wifi,
      tone: 'blue'
    },
    {
      key: 'users',
      label: 'Utilisateurs',
      value: formatNumber(totalUserCount),
      helper: `${formatNumber(stats?.users?.shops)} boutiques`,
      icon: Users,
      tone: 'purple'
    },
    {
      key: 'payments',
      label: 'Paiements attente',
      value: formatNumber(stats?.payments?.waiting),
      helper: `${formatNumber(stats?.payments?.verified)} verifies`,
      icon: DollarSign,
      tone: 'green'
    },
    {
      key: 'complaints',
      label: 'Reclamations',
      value: formatNumber(pendingComplaintsCount),
      helper: complaintsLoading ? 'Chargement...' : `${formatNumber(complaints.length)} total`,
      icon: AlertCircle,
      tone: 'orange'
    }
  ];

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
    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status || 'Inconnu';
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
        className="rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Commande #{order._id.slice(-6)}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {order.customer?.name || 'Client'} · {order.deliveryCity}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center rounded-full bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-700">
              {statusLabel}
            </span>
            {order.paymentType === 'installment' && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
                Tranches
              </span>
            )}
            {order.deliveryMode === 'PICKUP' && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                Retrait boutique
              </span>
            )}
          </div>
        </div>
        {sellers.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-slate-300 space-y-1">
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
            to={`/admin/orders?orderId=${order._id}`}
            className="text-xs font-semibold text-neutral-600 hover:underline"
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
    <div className="glass-page-shell min-h-screen lg:min-h-0">
      <div className="glass-content-spacing mx-auto max-w-7xl space-y-8 py-6 sm:py-8 lg:px-8">
        <section className="glass-card relative overflow-hidden rounded-3xl p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  Admin Command Center
                </p>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">{pageTitle}</h1>
                <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">{pageSubtitle}</p>
                {stats?.generatedAt ? (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Derniere mise a jour: {formatDateTime(stats.generatedAt)}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
                <button
                  type="button"
                  onClick={refreshAll}
                  disabled={refreshing}
                  className="glass-card inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-60 dark:text-slate-100"
                >
                  <RefreshCw
                    size={16}
                    className={
                      refreshing ? 'animate-spin' : 'transition-transform duration-300 hover:rotate-180'
                    }
                  />
                  {refreshing ? 'Actualisation...' : 'Actualiser'}
                </button>
                <Link
                  to="/admin/settings"
                  className="glass-card inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-100"
                >
                  <Settings size={16} />
                  Parametres
                </Link>
                <Link
                  to="/admin/products"
                  className="soft-card soft-card-purple inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-purple-900 transition hover:shadow-md dark:text-purple-100"
                >
                  <BarChart3 size={16} />
                  Produits
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {heroQuickKpis.map((kpi) => (
                <AdminQuickKpiCard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  helper={kpi.helper}
                  icon={kpi.icon}
                  tone={kpi.tone}
                />
              ))}
            </div>

            {isMobileView && availableTabs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {availableTabs.map((tab) => {
                  const TabIcon = adminTabMeta[tab.key]?.icon || Activity;
                  const tabHelper = adminTabMeta[tab.key]?.helper;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveAdminTab(tab.key)}
                      className={`flex min-w-[142px] flex-shrink-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                        activeAdminTab === tab.key
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                          : 'border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100'
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                          activeAdminTab === tab.key
                            ? 'bg-white/20'
                            : 'bg-slate-100 dark:bg-slate-700'
                        }`}
                      >
                        <TabIcon size={16} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{tab.label}</span>
                        <span
                          className={`block truncate text-[11px] ${
                            activeAdminTab === tab.key ? 'text-white/80' : 'text-slate-500'
                          }`}
                        >
                          {tabHelper}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      {isFounder && (
        <section className="glass-card rounded-3xl p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="soft-card soft-card-purple inline-flex h-9 w-9 items-center justify-center rounded-xl text-purple-900 dark:text-purple-100">
                <Crown size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Mini widget founder</h2>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Synthèse live des métriques exécutives
                </p>
              </div>
            </div>
            <Link
              to="/admin/founder-intelligence"
              className="glass-card inline-flex min-h-[40px] items-center rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-100"
            >
              Ouvrir la vue complète
            </Link>
          </div>
          {founderMiniError ? (
            <p className="soft-card soft-card-red mt-3 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-100">
              {founderMiniError}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SectionStatCard
              label="Revenue / actif"
              value={formatCurrency(founderMini?.kpis?.revenuePerActiveUser)}
              helper={founderMiniLoading ? 'Mise à jour…' : `AOV ${formatCurrency(founderMini?.kpis?.averageOrderValue)}`}
              icon={TrendingUp}
            />
            <SectionStatCard
              label="Rétention 30j"
              value={`${Number(founderMini?.kpis?.retention30Day || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              helper={`7j ${Number(founderMini?.kpis?.retention7Day || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              icon={Users}
            />
            <SectionStatCard
              label="Churn détecté"
              value={`${Number(founderMini?.kpis?.churnDetectionRate || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              helper={`${formatNumber(founderMini?.kpis?.highValueUsers)} utilisateurs forte valeur`}
              icon={AlertCircle}
            />
            <SectionStatCard
              label="Croissance hebdo"
              value={`${Number(founderMini?.kpis?.growthVelocity?.weekly || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              helper={`Daily ${Number(founderMini?.kpis?.growthVelocity?.daily || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              icon={ArrowUpRight}
            />
            <SectionStatCard
              label="Full payment"
              value={`${Number(founderMini?.kpis?.fullPaymentConversion?.adoptionRate || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`}
              helper={`${formatNumber(founderMini?.kpis?.fullPaymentConversion?.ordersPaidInFull)} commandes · ${formatCurrency(founderMini?.kpis?.fullPaymentConversion?.waivedDeliveryAmount)}`}
              icon={Sparkles}
            />
          </div>
        </section>
      )}

      {canViewStats && shouldShowSection('overview') && (
        <>
          <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-100">
              <Activity size={20} className="text-neutral-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Vue d'ensemble</h2>
              {stats?.generatedAt && (
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
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
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
              <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Chargement des statistiques…</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Utilisateurs en ligne"
                value={formatNumber(onlineStats?.totalOnline)}
                subtitle={
                  onlineStatsLoading
                    ? 'Mise à jour…'
                    : `DAU ${formatNumber(onlineStats?.dau)} · Pic ${formatNumber(onlineStats?.peakToday)}`
                }
                icon={Wifi}
                highlight
              />
              <StatCard
                title="Acheteurs en ligne"
                value={formatNumber(onlineStats?.usersOnline)}
                subtitle={`WAU ${formatNumber(onlineStats?.weeklyActiveUsers)}`}
                icon={Users}
              />
              <StatCard
                title="Vendeurs en ligne"
                value={formatNumber(onlineStats?.sellersOnline)}
                subtitle="Sessions boutiques"
                icon={Store}
              />
              <StatCard
                title="Admins en ligne"
                value={formatNumber(onlineStats?.adminsOnline)}
                subtitle="Surveillance temps réel"
                icon={Shield}
              />
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Type d’appareil connecté</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Répartition des sessions actives (mobile, tablette, PC)
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                  {formatNumber(totalDeviceSessions)} sessions
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {deviceStatsCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-white ${item.color}`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(item.count)}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{item.percent}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    Monitoring temps réel ({realtimeWindowMinutes} min)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Pages les plus visitées, likes et commentaires en continu.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                  {realtimeMonitoringLoading ? 'Mise à jour…' : `MAJ ${formatDateTime(realtimeMonitoring?.updatedAt) || '—'}`}
                </span>
              </div>
              <div className="mt-3 inline-flex items-center rounded-xl bg-gray-100 dark:bg-slate-800 p-1">
                {REALTIME_WINDOW_OPTIONS.map((option) => {
                  const active = realtimeWindowMinutes === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRealtimeWindowMinutes(option.value)}
                      className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition ${
                        active
                          ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-sm'
                          : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-slate-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {realtimeMonitoringError ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {realtimeMonitoringError}
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Visites pages</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(realtimeTotals?.pageViews)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Likes</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(realtimeTotals?.likes)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Commentaires</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(realtimeTotals?.comments)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Visiteurs uniques</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-slate-100">{formatNumber(realtimeTotals?.uniqueVisitors)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">Top pages</p>
                  <div className="mt-2 space-y-2">
                    {realtimeTopPages.length ? (
                      realtimeTopPages.slice(0, 6).map((item, index) => (
                        <div
                          key={`${item.path}-${index}`}
                          className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 px-2.5 py-2 text-xs text-gray-700 dark:text-slate-200"
                        >
                          <span className="truncate pr-2 font-medium">{item.path || '/'}</span>
                          <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-gray-800 dark:text-slate-200">
                            {formatNumber(item.views)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-slate-400">Aucune donnée de navigation récente.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">Activité récente</p>
                  <div className="mt-2 space-y-2">
                    {realtimeRecentEvents.length ? (
                      realtimeRecentEvents.slice(0, 6).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-lg bg-white dark:bg-slate-900 px-2.5 py-2 text-xs text-gray-700 dark:text-slate-200"
                        >
                          <p className="font-semibold text-gray-900 dark:text-slate-100">
                            {String(event.eventType || '').toUpperCase()}
                            {event.path ? ` · ${event.path}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">
                            {formatDateTime(event.createdAt)} · {event.role || 'guest'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-slate-400">Aucun signal capturé.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
          </div>
        )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Santé du cache</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Redis + cache mémoire (isolation par scope utilisateur/rôle)
                </p>
              </div>
            </div>
            {cacheStatsError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">{cacheStatsError}</p>
              </div>
            ) : null}
            {cacheStatsLoading && !cacheStats ? (
              <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-sm text-gray-500 dark:text-slate-400">
                Chargement des métriques cache…
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SectionStatCard
                    label="Hit ratio"
                    value={`${cacheHitRatio.toFixed(2)} %`}
                    helper={`${formatNumber(cacheHits)} hits / ${formatNumber(cacheReads)} lectures`}
                    icon={TrendingUp}
                  />
                  <SectionStatCard
                    label="Redis"
                    value={cacheStats?.redis?.ready ? 'Connecté' : 'Fallback mémoire'}
                    helper={`${formatNumber(cacheStats?.redis?.keyCount || 0)} clés`}
                    icon={Activity}
                  />
                  <SectionStatCard
                    label="Mémoire Redis"
                    value={
                      cacheStats?.redis?.memoryUsedHuman ||
                      formatBytes(cacheStats?.redis?.memoryUsedBytes || 0)
                    }
                    helper={`L1 mémoire: ${formatNumber(cacheStats?.hotCacheSize || 0)} entrées`}
                    icon={BarChart3}
                  />
                  <SectionStatCard
                    label="Invalidations / erreurs"
                    value={`${formatNumber(cacheStats?.invalidations || 0)} / ${formatNumber(cacheErrors)}`}
                    helper={`SET: ${formatNumber(cacheStats?.sets || 0)} • MISS: ${formatNumber(cacheStats?.misses || 0)}`}
                    icon={AlertCircle}
                  />
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Tendance hit ratio (échantillons récents)</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{cacheHistory.length} points</p>
                  </div>
                  {cacheHistory.length > 1 ? (
                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cacheHistory}>
                          <Line
                            type="monotone"
                            dataKey="hitRatio"
                            stroke="#0a0a0a"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-slate-400">Pas assez de points pour afficher la tendance.</p>
                  )}
                </div>
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
                  <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Commandes globales</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Suivi des commandes et livraisons</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemindersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-semibold text-neutral-700 transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-300"
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
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-300">Chargement des statistiques…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Commandes totales"
                    value={formatNumber(orderStats.total || 0)}
                    subtitle="Toutes les commandes"
                    icon={FileText}
                  />
                  <StatCard
                    title="Paiement"
                    value={formatNumber(orderStatusCount('pending_payment'))}
                    subtitle="En attente de paiement"
                    icon={Clock}
                  />
                  <StatCard
                    title="En attente validation"
                    value={formatNumber(orderStatusCount('pending', 'pending_installment'))}
                    subtitle="Préparation requise"
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Prêtes au retrait"
                    value={formatNumber(orderStatusCount('ready_for_pickup'))}
                    subtitle="Boutique / retrait"
                    icon={Package}
                  />
                  <StatCard
                    title="Prêtes à livrer"
                    value={formatNumber(orderStatusCount('ready_for_delivery', 'confirmed'))}
                    subtitle="Avant expédition"
                    icon={Package}
                  />
                  <StatCard
                    title="En livraison"
                    value={formatNumber(orderStatusCount('out_for_delivery', 'delivering', 'delivery_proof_submitted'))}
                    subtitle="Transport en cours"
                    icon={Package}
                  />
                  <StatCard
                    title="Livrées"
                    value={formatNumber(orderStatusCount('delivered', 'confirmed_by_client', 'picked_up_confirmed', 'completed'))}
                    subtitle="Retraits confirmés, confirmées client, paiement terminé"
                    icon={CheckCircle}
                  />
                  <StatCard
                    title="Annulées"
                    value={formatNumber(orderStatusCount('cancelled'))}
                    subtitle="Commandes fermées"
                    icon={X}
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
                    title="Reste a payer"
                    value={formatCurrency(orderStats.remainingAmount || 0)}
                    subtitle="Soldes ouverts"
                    icon={AlertCircle}
                  />
                </div>
                <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Répartition par statut backend</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Même mapping que /admin/orders</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {ORDER_STATUS_SUMMARY_OPTIONS.map((statusItem) => (
                      <div
                        key={statusItem.value}
                        className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/80 px-3 py-2"
                      >
                        <p className="truncate text-[11px] font-medium text-gray-600 dark:text-slate-300">
                          {statusItem.label}
                        </p>
                        <p className="mt-1 text-base font-bold text-gray-900 dark:text-slate-100">
                          {formatNumber(orderStatusCount(statusItem.value))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {isAdmin && (
            <>
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-100">
                    <MessageSquare size={20} className="text-neutral-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Notification globale</h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Envoyer une notification à tous les utilisateurs ou filtrer par type de compte</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  {broadcastError && <p className="text-sm text-red-600 mb-3">{broadcastError}</p>}
                  {broadcastSuccess && <p className="text-sm text-emerald-600 mb-3">{broadcastSuccess}</p>}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Destinataires</label>
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      >
                        <option value="all">Tous les utilisateurs</option>
                        <option value="person">Particuliers uniquement</option>
                        <option value="shop">Boutiques uniquement</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Titre (optionnel)</label>
                      <input
                        type="text"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="Ex : Actualités"
                        maxLength={200}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Message *</label>
                      <textarea
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Contenu de la notification..."
                        rows={4}
                        maxLength={2000}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{broadcastMessage.length} / 2000</p>
                    </div>
                    <button
                      type="button"
                      onClick={sendBroadcast}
                      disabled={broadcastSending || !broadcastMessage.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-neutral-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {broadcastSending ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Envoi en cours…
                        </>
                      ) : (
                        <>
                          <MessageSquare size={16} />
                          Envoyer la notification
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-100">
                    <Phone size={20} className="text-neutral-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Export des numéros de téléphone</h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Télécharger la liste des numéros au format CSV (particuliers, boutiques ou tous)</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  {exportError && <p className="text-sm text-red-600 mb-3">{exportError}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={exportTarget}
                      onChange={(e) => setExportTarget(e.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    >
                      <option value="all">Tous les utilisateurs</option>
                      <option value="person">Particuliers uniquement</option>
                      <option value="shop">Boutiques uniquement</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleExportPhones}
                      disabled={exportLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-neutral-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportLoading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Export…
                        </>
                      ) : (
                        <>
                          <FileText size={16} />
                          Exporter en CSV
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          <BaseModal
            isOpen={remindersOpen}
            onClose={() => setRemindersOpen(false)}
            size="xl"
            mobileSheet
            ariaLabel="Relances commandes"
            panelClassName="sm:max-w-3xl"
          >
            <ModalHeader
              title="Suivi des statuts alignés sur /admin/orders"
              subtitle="Les statuts livrés, paiement terminé et annulé sont exclus automatiquement."
              onClose={() => setRemindersOpen(false)}
            />
            <ModalBody className="space-y-4">
              <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">
                      Filtres commandes
                    </p>
                    <button
                      type="button"
                      onClick={resetReminderFilters}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                      <RefreshCw size={12} />
                      Réinitialiser
                    </button>
                  </div>
                  <div className="space-y-2 sm:hidden">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Statut
                      </p>
                      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                        {REMINDER_STATUS_FILTER_OPTIONS.map((statusOption) => {
                          const isActive = reminderStatusFilter === statusOption.value;
                          return (
                            <button
                              key={statusOption.value}
                              type="button"
                              onClick={() => setReminderStatusFilter(statusOption.value)}
                              aria-pressed={isActive}
                              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isActive
                                  ? 'border-neutral-700 bg-neutral-700 text-white'
                                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200'
                              }`}
                            >
                              {statusOption.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Paiement
                      </p>
                      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                        {REMINDER_PAYMENT_TYPE_FILTER_OPTIONS.map((paymentOption) => {
                          const optionValue = paymentOption.value || '';
                          const isActive = reminderPaymentTypeFilter === optionValue;
                          return (
                            <button
                              key={optionValue || 'all'}
                              type="button"
                              onClick={() =>
                                setReminderPaymentTypeFilter((prev) =>
                                  prev === optionValue ? '' : optionValue
                                )
                              }
                              aria-pressed={isActive}
                              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isActive
                                  ? 'border-neutral-700 bg-neutral-700 text-white'
                                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200'
                              }`}
                            >
                              {paymentOption.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Livraison
                      </p>
                      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                        {REMINDER_DELIVERY_MODE_FILTER_OPTIONS.map((deliveryOption) => {
                          const optionValue = deliveryOption.value || '';
                          const isActive = reminderDeliveryModeFilter === optionValue;
                          return (
                            <button
                              key={optionValue || 'all'}
                              type="button"
                              onClick={() =>
                                setReminderDeliveryModeFilter((prev) =>
                                  prev === optionValue ? '' : optionValue
                                )
                              }
                              aria-pressed={isActive}
                              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isActive
                                  ? 'border-neutral-700 bg-neutral-700 text-white'
                                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200'
                              }`}
                            >
                              {deliveryOption.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-3">
                    <select
                      value={reminderStatusFilter}
                      onChange={(event) => setReminderStatusFilter(event.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-neutral-500"
                    >
                      {REMINDER_STATUS_FILTER_OPTIONS.map((statusOption) => (
                        <option key={statusOption.value} value={statusOption.value}>
                          {statusOption.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={reminderPaymentTypeFilter}
                      onChange={(event) => setReminderPaymentTypeFilter(event.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-neutral-500"
                    >
                      {REMINDER_PAYMENT_TYPE_FILTER_OPTIONS.map((paymentOption) => (
                        <option key={paymentOption.value || 'all'} value={paymentOption.value}>
                          {paymentOption.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={reminderDeliveryModeFilter}
                      onChange={(event) => setReminderDeliveryModeFilter(event.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-neutral-500"
                    >
                      {REMINDER_DELIVERY_MODE_FILTER_OPTIONS.map((deliveryOption) => (
                        <option key={deliveryOption.value || 'all'} value={deliveryOption.value}>
                          {deliveryOption.label}
                        </option>
                      ))}
                    </select>
                  </div>
              </div>

              {remindersLoading ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">Chargement des commandes…</p>
              ) : remindersError ? (
                <p className="text-sm text-red-600">{remindersError}</p>
              ) : reminderOrders.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">Aucune commande à relancer.</p>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-neutral-600">
                        Commandes +48h non livrées
                      </p>
                      <span className="text-xs font-semibold text-neutral-600">
                        {overdueReminderOrders.length}
                      </span>
                    </div>
                    {overdueReminderOrders.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Aucune commande en retard pour le moment.
                      </p>
                    ) : (
                      overdueReminderOrders.map(renderReminderOrderCard)
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Autres commandes à relancer
                    </p>
                    {regularReminderOrders.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Aucune autre commande à relancer.
                      </p>
                    ) : (
                      regularReminderOrders.map(renderReminderOrderCard)
                    )}
                  </div>
                </div>
              )}
            </ModalBody>
          </BaseModal>

          {/* Analytics Charts Section */}
          {canViewStats && (
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-100">
                  <BarChart3 size={20} className="text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Analytics en Temps Réel</h3>
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                    Graphiques interactifs et analyses détaillées de l'activité
                  </p>
                </div>
              </div>

              {/* Sales Trends Chart */}
              <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">Tendances de Vente</h4>
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
                            ? 'bg-neutral-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200'
                        }`}
                      >
                        {days}j
                      </button>
                    ))}
                  </div>
                </div>
                {salesTrendsLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
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
                          if (name === 'Revenus') {
                            return formatCurrency(value);
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
                        name="Revenus"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-12">Aucune donnée disponible</p>
                )}
              </div>

              {/* Order Heatmap */}
              <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Heatmap des Heures de Pointe</h4>
                {orderHeatmapLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
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
                  <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-12">Aucune donnée disponible</p>
                )}
              </div>

              {/* Conversion Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Métriques de Conversion</h4>
                  {conversionLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
                    </div>
                  ) : conversionMetrics ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <span className="text-sm text-gray-700 dark:text-slate-200">Visiteurs uniques</span>
                        <span className="text-lg font-bold text-neutral-600">
                          {conversionMetrics.metrics.uniqueVisitors.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-700 dark:text-slate-200">Clients uniques</span>
                        <span className="text-lg font-bold text-green-600">
                          {conversionMetrics.metrics.uniqueCustomers.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <span className="text-sm text-gray-700 dark:text-slate-200">Taux de conversion</span>
                        <span className="text-lg font-bold text-neutral-600">
                          {conversionMetrics.metrics.visitorToOrderRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                        <span className="text-sm text-gray-700 dark:text-slate-200">Vues totales</span>
                        <span className="text-lg font-bold text-amber-600">
                          {conversionMetrics.metrics.totalViews.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>

                {/* Cohort Analysis */}
                <div className="rounded-2xl border border-gray-200/60 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Analyse de Cohort</h4>
                  {cohortLoading ? (
                    <div className="h-48 flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
                    </div>
                  ) : cohortAnalysis?.cohorts?.length ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cohortAnalysis.cohorts.slice(-6).map((cohort) => (
                        <div key={cohort.cohort} className="p-3 bg-gray-50 dark:bg-slate-900/70 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{cohort.label}</span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              {cohort.retentionRate}% rétention
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-slate-300">
                            <span>{cohort.totalUsers} utilisateurs</span>
                            <span>{cohort.activeUsers} actifs</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Aucune donnée disponible</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Orders by Hour Modal */}
          <BaseModal
            isOpen={selectedHour !== null}
            onClose={() => {
              setSelectedHour(null);
              setHourOrders([]);
            }}
            size="xl"
            mobileSheet
            ariaLabel="Commandes par heure"
            panelClassName="sm:max-w-4xl"
          >
            <ModalHeader
              title={`Commandes créées à ${String(selectedHour ?? '').padStart(2, '0')}:00`}
              subtitle={`Derniers 30 jours · ${hourOrders.length} commande${hourOrders.length > 1 ? 's' : ''}`}
              onClose={() => {
                setSelectedHour(null);
                setHourOrders([]);
              }}
            />
            <ModalBody className="pr-2">
                  {hourOrdersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-600" />
                    </div>
                  ) : hourOrdersError ? (
                    <p className="text-sm text-red-600 text-center py-8">{hourOrdersError}</p>
                  ) : hourOrders.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-12">Aucune commande trouvée pour cette heure.</p>
                  ) : (
                    <div className="space-y-4">
                      {hourOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 p-4 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                  {order.customer?.name || 'Client inconnu'}
                                </span>
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    order.status === 'delivered'
                                      ? 'bg-green-100 text-green-800'
                                      : order.status === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : order.status === 'delivering'
                                      ? 'bg-neutral-100 text-neutral-800'
                                      : order.status === 'confirmed'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
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
                                <p className="text-xs text-gray-600 dark:text-slate-300">{order.customer.email}</p>
                              )}
                              {order.customer?.phone && (
                                <p className="text-xs text-gray-600 dark:text-slate-300">{order.customer.phone}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                {formatCurrency(order.totalAmount || 0)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                          </div>

                          {order.items?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs font-semibold text-gray-700 dark:text-slate-200 mb-2">Articles:</p>
                              <div className="space-y-1">
                                {order.items.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-700 dark:text-slate-200">
                                      {item.product?.title || item.snapshot?.title || 'Produit'} × {item.quantity || 1}
                                    </span>
                                    {item.product?.price && (
                                      <span className="text-gray-600 dark:text-slate-300">
                                        {formatCurrency(item.product.price * (item.quantity || 1))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {order.items.length > 3 && (
                                  <p className="text-xs text-gray-500 dark:text-slate-400">
                                    +{order.items.length - 3} autre{order.items.length - 3 > 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {order.deliveryAddress && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-gray-600 dark:text-slate-300">
                                <MapPin size={12} className="inline mr-1" />
                                {order.deliveryAddress}
                                {order.deliveryCity && `, ${order.deliveryCity}`}
                              </p>
                            </div>
                          )}

                          {order.deliveryCode && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-neutral-600">
                                Code: {order.deliveryCode}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
            </ModalBody>
          </BaseModal>

          {(cityStats.length > 0 || genderStats.length > 0 || productCityStats.length > 0 || productGenderStats.length > 0) && (
            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {cityStats.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Répartition des utilisateurs par ville</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Principales localisations des membres enregistrés.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Ville</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Utilisateurs</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityStats.slice(0, 8).map((item) => (
                      <tr key={item.city} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700 dark:text-slate-200">{item.city}</td>
                        <td className="p-2 text-gray-900 dark:text-slate-100 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 dark:text-slate-400 text-right">{formatPercent(item.count, totalUserCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {genderStats.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Répartition des utilisateurs par genre</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Déclaration lors de l’inscription.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Genre</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Utilisateurs</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genderStats.map((item) => (
                      <tr key={item.gender} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700 dark:text-slate-200">{item.gender}</td>
                        <td className="p-2 text-gray-900 dark:text-slate-100 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 dark:text-slate-400 text-right">{formatPercent(item.count, totalUserCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {productCityStats.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Annonces par ville</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Localisation déclarée des vendeurs au moment de la publication.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Ville</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Annonces</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productCityStats.slice(0, 8).map((item) => (
                      <tr key={item.city} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700 dark:text-slate-200">{item.city}</td>
                        <td className="p-2 text-gray-900 dark:text-slate-100 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 dark:text-slate-400 text-right">{formatPercent(item.count, totalProductCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {productGenderStats.length > 0 && (
            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Annonces par genre</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Répartition selon le genre des vendeurs.</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-900/70">
                    <tr>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Genre</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Annonces</th>
                      <th className="p-2 font-medium text-gray-600 dark:text-slate-300 text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productGenderStats.map((item) => (
                      <tr key={item.gender} className="border-b last:border-b-0">
                        <td className="p-2 text-gray-700 dark:text-slate-200">{item.gender}</td>
                        <td className="p-2 text-gray-900 dark:text-slate-100 text-right">{formatNumber(item.count)}</td>
                        <td className="p-2 text-gray-500 dark:text-slate-400 text-right">{formatPercent(item.count, totalProductCount)}</td>
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
        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Tendances des 6 derniers mois</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
            Nouveaux utilisateurs, annonces créées et revenus vérifiés par mois.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/70">
                <tr>
                  <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Mois</th>
                  <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Utilisateurs</th>
                  <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Annonces</th>
                  <th className="p-2 font-medium text-gray-600 dark:text-slate-300">Revenus</th>
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
                    <td className="p-2 text-sm text-gray-500 dark:text-slate-400" colSpan={4}>
                      Aucune donnée disponible pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Catégories les plus actives</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Top 5 des catégories par nombre d&apos;annonces approuvées.</p>
          </div>
          {stats?.topCategories?.length ? (
            <ul className="space-y-3">
              {stats.topCategories.map((cat) => (
                <li key={cat.category} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{cat.category}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Prix moyen&nbsp;: {formatCurrency(cat.avgPrice)}</p>
                  </div>
                  <span className="text-sm font-semibold text-neutral-600">
                    {formatNumber(cat.listings)} annonces
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400">Pas encore assez de données.</p>
          )}
        </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Nouveaux utilisateurs</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">5 derniers inscrits sur la plateforme.</p>
          <ul className="space-y-3">
            {stats?.recent?.users?.length ? (
              stats.recent.users.map((user) => (
                <li key={user.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    {resolveUserProfileImage(user) ? (
                      <img
                        src={resolveUserProfileImage(user)}
                        alt={user.name || 'Utilisateur'}
                        className="mt-0.5 h-8 w-8 rounded-full object-cover ring-1 ring-gray-200"
                      />
                    ) : (
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400">
                        {String(user.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {user.role === 'admin' ? 'Admin · ' : user.role === 'founder' ? 'Founder · ' : ''}
                        {user.accountType === 'shop' ? 'Boutique' : 'Particulier'} · {formatDate(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500 dark:text-slate-400">Aucun utilisateur récent.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Dernières annonces</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">5 annonces récemment créées.</p>
          <ul className="space-y-3">
            {stats?.recent?.products?.length ? (
              stats.recent.products.map((product) => (
                <li key={product.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{product.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {formatCurrency(product.price)} · {product.owner || 'Auteur inconnu'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {productStatusLabels[product.status] || product.status} · {formatDate(product.createdAt)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500 dark:text-slate-400">Aucune annonce récente.</li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Paiements récents</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">5 derniers paiements reçus.</p>
            </div>
            <Link
              to="/admin/payments"
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-700"
            >
              Voir tous →
            </Link>
          </div>
          <ul className="space-y-3">
            {stats?.recent?.payments?.length ? (
              stats.recent.payments.map((payment) => (
                <li key={payment.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{payment.payerName}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        paymentStatusStyles[payment.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                      }`}
                    >
                      {paymentStatusLabels[payment.status] || payment.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {formatCurrency(payment.amount)} · {payment.operator}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
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
              <li className="text-sm text-gray-500 dark:text-slate-400">Aucun paiement récent.</li>
            )}
          </ul>
        </div>
          </section>
        </>
      )}

      {canManageUsers && shouldShowSection('users') && (
        <section className="rounded-2xl border border-gray-200/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Desktop: header strip with icon and primary action */}
          <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:border-b lg:border-gray-100 dark:border-slate-700 lg:bg-gradient-to-r lg:from-gray-50/80 lg:to-white">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <Users size={22} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Gestion des utilisateurs</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400 max-w-xl">
                  Recherchez un compte particulier et convertissez-le en boutique si nécessaire.
                </p>
                <Link
                  to="/admin/users"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  Ouvrir la gestion des suspensions
                  <ChevronRight size={16} className="shrink-0" />
                </Link>
              </div>
            </div>
            <Link
              to="/admin/users"
              className="hidden lg:inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-700 transition-colors"
            >
              Gestion des suspensions
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            <SectionStatCard
              label="Utilisateurs"
              value={formatNumber(stats?.users?.total)}
              helper={`Boutiques : ${formatNumber(stats?.users?.shops)}`}
              icon={Users}
            />
            <SectionStatCard
              label="Utilisateurs bloqués"
              value={formatNumber(stats?.users?.blocked || 0)}
              helper="À surveiller"
              icon={Shield}
            />
            <SectionStatCard
              label="Nouveaux (30j)"
              value={formatNumber(stats?.users?.newLast30Days)}
              helper="Indicateur 30 jours"
              icon={Activity}
            />
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:rounded-xl lg:border lg:border-gray-200/80 lg:bg-gray-50/50 lg:p-3 lg:gap-3 dark:lg:border-slate-700 dark:lg:bg-slate-900/60"
            onSubmit={(e) => {
              e.preventDefault();
              setEditingUser(null);
              setUsersError('');
              setUserSuccessMessage('');
            }}
          >
            <input
              type="search"
              className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 sm:w-60"
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
                          ? 'bg-neutral-600 text-white shadow'
                          : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                  className="rounded bg-neutral-600 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
                  disabled={usersLoading}
                >
                  Rechercher
                </button>
                <button
                  type="button"
                  className="rounded border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
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
        {usersError ? <p className="text-sm text-red-600">{usersError}</p> : null}
        {userSuccessMessage ? <p className="text-sm text-green-600">{userSuccessMessage}</p> : null}
        {isMobileView ? (
          <div className="space-y-4">
            {usersLoading ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Chargement des utilisateurs…</p>
            ) : paginatedUsers.length ? (
              paginatedUsers.map((user) => {
                const isManagerRole = user.role === 'manager';
                const isAdminRole = user.role === 'admin' || user.role === 'founder';
                const isSelf = authUser?.id === user.id;
                const nextRole = isManagerRole ? 'user' : 'manager';
                return (
                  <div key={user.id} className="space-y-3 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-3">
                        {resolveUserProfileImage(user) ? (
                          <img
                            src={resolveUserProfileImage(user)}
                            alt={user.name || 'Utilisateur'}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-sm font-semibold text-gray-500 dark:text-slate-400">
                            {String(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-slate-100">{user.name}</p>
                          <p className="break-all text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">Inscrit le {formatDate(user.createdAt)}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                        {user.role}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-slate-300">
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
                        <span className="inline-flex items-center rounded bg-gray-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:text-slate-200">
                          Particulier
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {user.accountType === 'shop' ? (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="w-full rounded border border-gray-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
                        <div className="space-y-2 rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 p-3 text-xs">
                          <p className="font-semibold text-gray-700 dark:text-slate-200">Conversion en boutique</p>
                          <label className="space-y-1 text-gray-600 dark:text-slate-300">
                            <span>Nom de la boutique</span>
                            <input
                              type="text"
                              className="w-full rounded border px-2 py-1 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                              value={editingUser.shopName}
                              onChange={(e) =>
                                setEditingUser((prev) =>
                                  prev && prev.id === user.id ? { ...prev, shopName: e.target.value } : prev
                                )
                              }
                              disabled={updatingUserId === user.id}
                            />
                          </label>
                          <label className="space-y-1 text-gray-600 dark:text-slate-300">
                            <span>Adresse de la boutique</span>
                            <input
                              type="text"
                              className="w-full rounded border px-2 py-1 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                              className="flex-1 rounded bg-neutral-600 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
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
                              className="flex-1 rounded border border-gray-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
                          className="w-full rounded bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
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
                      <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                        {isAdminRole ? (
                          <p className="text-xs text-gray-500 dark:text-slate-400">Rôle administrateur non modifiable.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
                              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                Vous ne pouvez pas modifier votre propre rôle.
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <Link
                        to={`/admin/users/${user.id}/stats`}
                        className="text-xs font-semibold text-neutral-600 hover:text-neutral-800"
                      >
                        Voir ses statistiques →
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400">Aucun utilisateur ne correspond à la recherche actuelle.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-100 dark:bg-slate-800">
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
                    <td className="p-3 text-sm text-gray-500 dark:text-slate-400" colSpan={6}>
                      Chargement des utilisateurs…
                    </td>
                  </tr>
                ) : paginatedUsers.length ? (
                  paginatedUsers.map((user) => {
                    const isManagerRole = user.role === 'manager';
                    const isAdminRole = user.role === 'admin' || user.role === 'founder';
                    const isSelf = authUser?.id === user.id;
                    const nextRole = isManagerRole ? 'user' : 'manager';
                    return (
                      <tr key={user.id} className="align-top">
                        <td className="p-2 border">
                          <div className="flex items-start gap-2.5">
                            {resolveUserProfileImage(user) ? (
                              <img
                                src={resolveUserProfileImage(user)}
                                alt={user.name || 'Utilisateur'}
                                className="mt-0.5 h-8 w-8 rounded-full object-cover ring-1 ring-gray-200"
                              />
                            ) : (
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-semibold text-gray-500 dark:text-slate-400">
                                {String(user.name || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900 dark:text-slate-100">{user.name}</p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">Rôle&nbsp;: {user.role}</p>
                            </div>
                          </div>
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
                                <p className="text-xs text-gray-600 dark:text-slate-300 truncate">{user.shopName}</p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded bg-gray-100 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
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
                                  className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
                                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
                                  Nom de la boutique
                                  <input
                                    className="w-full rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                    value={editingUser.shopName}
                                    onChange={(e) =>
                                      setEditingUser((prev) =>
                                        prev && prev.id === user.id ? { ...prev, shopName: e.target.value } : prev
                                      )
                                    }
                                    disabled={updatingUserId === user.id}
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
                                  Adresse de la boutique
                                  <textarea
                                    className="w-full rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                                    className="flex-1 rounded bg-neutral-600 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-60"
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
                                    className="flex-1 rounded border border-gray-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
                                className="rounded bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
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
                        <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                          {isAdminRole ? (
                            <p className="text-xs text-gray-500 dark:text-slate-400">Rôle administrateur non modifiable.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
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
                                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                  Vous ne pouvez pas modifier votre propre rôle.
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <Link
                          to={`/admin/users/${user.id}/stats`}
                          className="text-xs font-semibold text-neutral-600 hover:text-neutral-800"
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
                    <td className="p-3 text-sm text-gray-500 dark:text-slate-400" colSpan={6}>
                      Aucun utilisateur ne correspond à la recherche actuelle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!usersLoading && (
          <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700 pt-4 text-xs text-gray-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {users.length
                ? `Affichage ${usersRangeStart}-${usersRangeEnd} sur ${users.length} utilisateurs`
                : 'Aucun utilisateur pour ces critères.'}
            </p>
            {users.length ? (
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                  disabled={usersPage <= 1}
                >
                  Précédent
                </button>
                <span className="font-medium text-gray-700 dark:text-slate-200">
                  Page {usersPage} / {totalUserPages}
                </span>
                <button
                  type="button"
                  className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setUsersPage((prev) => Math.min(totalUserPages, prev + 1))}
                  disabled={usersPage >= totalUserPages}
                >
                  Suivant
                </button>
              </div>
            ) : null}
          </div>
        )}
          </div>
        </section>
      )}

      {canManagePayments && shouldShowSection('payments') && (
        <section className="rounded-2xl border border-gray-200/80 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Desktop: header strip with icon and description */}
          <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:border-b lg:border-gray-100 dark:border-slate-700 lg:bg-gradient-to-r lg:from-gray-50/80 lg:to-white">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <DollarSign size={22} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Vérification des paiements</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400 max-w-xl">
                  Validez ou rejetez les preuves de paiement envoyées par les vendeurs.
                </p>
              </div>
            </div>
            <Link
              to="/admin/payment-verification"
              className="hidden lg:inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-700 transition-colors"
            >
              Ouvrir la vérification
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            <SectionStatCard
              label="En attente"
              value={formatNumber(stats?.payments?.waiting)}
              helper="Paiements non vérifiés"
              icon={Clock}
            />
            <SectionStatCard
              label="Validés"
              value={formatNumber(stats?.payments?.verified)}
              helper="Paiements acceptés"
              icon={CheckCircle}
            />
            <SectionStatCard
              label="CA validé"
              value={formatCurrency(stats?.payments?.revenue)}
              helper="Total confirmé"
              icon={DollarSign}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:rounded-xl lg:border lg:border-gray-200/80 lg:bg-gray-50/50 lg:p-3 dark:lg:border-slate-700 dark:lg:bg-slate-900/60">
            {isMobileView ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {paymentFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      filter === option.value
                        ? 'bg-neutral-600 text-white shadow'
                        : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-slate-300" htmlFor="admin-payments-filter">
                  Statut&nbsp;:
                </label>
                <select
                  id="admin-payments-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                className="w-full rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
              />
            </div>
          </div>
        {paymentActionMessage ? <p className="text-sm text-green-600">{paymentActionMessage}</p> : null}
        {paymentActionError ? <p className="text-sm text-red-600">{paymentActionError}</p> : null}
        {isMobileView ? (
          <div className="space-y-4">
            {paginatedPayments.map((p) => (
              <div key={p._id} className="rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{p.product?.title || 'Annonce'}</p>
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${
                      paymentStatusStyles[p.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                    }`}
                  >
                    {paymentStatusLabels[p.status] || p.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <span>
                    Payeur : <strong className="text-gray-800 dark:text-slate-200">{p.payerName}</strong>
                  </span>
                  <span className="hidden xs:inline-block text-gray-400 dark:text-slate-500">•</span>
                  <span>
                    Opérateur : <strong className="text-gray-800 dark:text-slate-200">{p.operator}</strong>
                  </span>
                  <span className="hidden xs:inline-block text-gray-400 dark:text-slate-500">•</span>
                  <span>
                    Montant : <strong className="text-gray-800 dark:text-slate-200">{formatCurrency(p.amount)}</strong>
                  </span>
                </div>
                {p.product?.images?.length ? (
                  <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700 p-2">
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
                      <span className="text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        +{p.product.images.length - 4} autres
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400">Aucune image pour cette annonce.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {p.product?._id && (
                    <Link
                      to={buildProductPath(p.product)}
                      {...externalLinkProps}
                      className="flex-1 min-w-[140px] rounded-lg border border-neutral-200 px-3 py-2 text-center text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Voir l&apos;annonce
                    </Link>
                  )}
                  {p.transactionNumber && (
                    <button
                      type="button"
                      className="flex-1 min-w-[140px] rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
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
                    <span className="text-xs text-gray-500 dark:text-slate-400">Action non disponible pour ce paiement.</span>
                  )}
                </div>
              </div>
            ))}
            {!payments.length && (
              <p className="text-sm text-gray-500 dark:text-slate-400">Aucun paiement ne correspond à la recherche actuelle.</p>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100 dark:bg-slate-800">
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
                          <span className="text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                            +{p.product.images.length - 3} autres
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-slate-400">Aucune image</span>
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
                        paymentStatusStyles[p.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
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
                          className="rounded border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                        >
                          Voir l&apos;annonce
                        </Link>
                      ) : null}
                      {p.transactionNumber ? (
                        <button
                          type="button"
                          className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
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
                        <span className="self-center text-xs text-gray-500 dark:text-slate-400">Action non disponible</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td className="p-4 text-sm text-gray-500 dark:text-slate-400" colSpan={8}>
                    Aucun paiement à afficher pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-slate-700 pt-4 text-xs text-gray-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {payments.length
              ? `Affichage ${paymentsRangeStart}-${paymentsRangeEnd} sur ${payments.length} paiements`
              : 'Aucun paiement à afficher.'}
          </p>
          {payments.length ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setPaymentsPage((prev) => Math.max(1, prev - 1))}
                disabled={paymentsPage <= 1}
              >
                Précédent
              </button>
              <span className="font-medium text-gray-700 dark:text-slate-200">
                Page {paymentsPage} / {totalPaymentPages}
              </span>
              <button
                type="button"
                className="rounded border border-gray-300 dark:border-slate-600 px-3 py-1 font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </section>
      )}

      {canManageComplaints && shouldShowSection('complaints') && (
        <section className="rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Réclamations</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Consultez les plaintes déposées par les utilisateurs et attribuez un statut adapté.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <select
                value={complaintsFilter}
                onChange={(e) => setComplaintsFilter(e.target.value)}
                className="rounded border px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
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
                className="rounded border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
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
            <p className="text-sm text-gray-500 dark:text-slate-400">Chargement des réclamations…</p>
          ) : complaintsError ? (
            <p className="text-sm text-red-600">{complaintsError}</p>
          ) : (
            <ul className="space-y-4">
              {complaints.length ? (
                complaints.map((complaint) => (
                  <li key={complaint._id} className="space-y-3 rounded-2xl border border-gray-100 dark:border-slate-700 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {complaint.subject || 'Sans objet'}
                        </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex flex-wrap gap-2">
                        <span>
                          {complaint.user?.name || 'Utilisateur anonyme'}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          {complaint.user?.email || 'Email introuvable'}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          {complaint.user?.phone || 'Téléphone non renseigné'}
                        </span>
                      </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(complaint.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            complaintStatusStyles[complaint.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
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
                          className="rounded border border-gray-200 dark:border-slate-700 px-3 py-1 text-xs text-gray-600 dark:text-slate-300 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                        >
                          {Object.keys(complaintStatusLabels).map((statusKey) => (
                            <option key={statusKey} value={statusKey}>
                              {complaintStatusLabels[statusKey]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line break-words">
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
                              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 hover:border-neutral-200"
                            >
                              <Paperclip className="w-3 h-3" />
                              {attachment.originalName || attachment.filename}
                            </a>
                          ))}
                      </div>
                    ) : null}
                    {complaint.adminNote ? (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        <span className="font-semibold text-gray-700 dark:text-slate-200">Note admin :</span>{' '}
                        {complaint.adminNote}
                      </p>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 dark:text-slate-400">Aucune réclamation pour ce filtre.</li>
              )}
            </ul>
          )}
        </section>
      )}
      <FloatingGlassButton
        icon={RefreshCw}
        label={refreshing ? 'Mise à jour...' : 'Actualiser'}
        onClick={refreshAll}
        disabled={refreshing}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-20 lg:hidden"
      />
      </div>
    </div>
  );
}
