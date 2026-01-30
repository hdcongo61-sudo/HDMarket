import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  Heart,
  MessageCircle,
  TrendingUp,
  BarChart3,
  Store,
  Star,
  Sparkles,
  Clock,
  X,
  Eye,
  ShoppingBag,
  DollarSign,
  Users,
  Award,
  Activity,
  Calendar,
  Target,
  Zap,
  MapPin
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';

const numberFormatter = new Intl.NumberFormat('fr-FR');
const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return numberFormatter.format(parsed);
};
const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const formatRelativeTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
};

const DEFAULT_STATS = {
  listings: { total: 0, approved: 0, pending: 0, rejected: 0, disabled: 0 },
  engagement: { favoritesReceived: 0, commentsReceived: 0, favoritesSaved: 0, shopsFollowed: 0 },
  performance: { views: 0, clicks: 0, conversion: 0 },
  breakdown: { categories: [], conditions: [] },
  timeline: [],
  topProducts: [],
  advertismentSpend: 0,
  orders: {
    purchases: {
      totalCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      totalItems: 0,
      byStatus: {
        pending: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 },
        confirmed: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 },
        delivering: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 },
        delivered: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 },
        cancelled: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 }
      }
    },
    sales: {
      totalCount: 0,
      totalAmount: 0,
      byStatus: {
        pending: { count: 0, totalAmount: 0 },
        confirmed: { count: 0, totalAmount: 0 },
        delivering: { count: 0, totalAmount: 0 },
        delivered: { count: 0, totalAmount: 0 },
        cancelled: { count: 0, totalAmount: 0 }
      }
    }
  }
};

const StatCard = ({ icon: Icon, label, value, subtitle, gradient, iconBg, trend }) => (
  <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
    <div className={`absolute inset-0 ${gradient.replace('from-', 'bg-').split(' ')[0]} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
    <div className="relative p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg} shadow-sm`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-700">{trend}</span>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  </div>
);

const MetricCard = ({ title, value, subtitle, icon: Icon, color = "indigo" }) => {
  const colorClasses = {
    indigo: { icon: "bg-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-600" },
    emerald: { icon: "bg-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600" },
    amber: { icon: "bg-amber-600", bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600" },
    purple: { icon: "bg-purple-600", bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-600" },
    rose: { icon: "bg-rose-600", bg: "bg-rose-50", border: "border-rose-100", text: "text-rose-600" }
  };
  const classes = colorClasses[color] || colorClasses.indigo;

  return (
    <div className={`rounded-xl border ${classes.border} ${classes.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${classes.icon}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};

export default function UserStats() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showFollowedModal, setShowFollowedModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderedProducts, setOrderedProducts] = useState([]);
  const [orderedLoading, setOrderedLoading] = useState(false);
  const [orderedError, setOrderedError] = useState('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [soldProducts, setSoldProducts] = useState([]);
  const [soldLoading, setSoldLoading] = useState(false);
  const [soldError, setSoldError] = useState('');
  const userShopLink = user?.accountType === 'shop' ? buildShopPath(user) : null;

  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/users/profile/stats');
        if (!active) return;
        setStats((prev) => ({
          ...DEFAULT_STATS,
          ...data,
          listings: { ...DEFAULT_STATS.listings, ...(data?.listings || {}) },
          engagement: { ...DEFAULT_STATS.engagement, ...(data?.engagement || {}) },
          performance: { ...DEFAULT_STATS.performance, ...(data?.performance || {}) },
          breakdown: {
            categories: data?.breakdown?.categories || [],
            conditions: data?.breakdown?.conditions || []
          },
          timeline: data?.timeline || [],
          topProducts: data?.topProducts || [],
          advertismentSpend: data?.advertismentSpend ?? prev.advertismentSpend ?? 0,
          followedShops: Array.isArray(data?.followedShops) ? data.followedShops : [],
          orders: {
            ...DEFAULT_STATS.orders,
            ...(data?.orders || {}),
            purchases: {
              ...DEFAULT_STATS.orders.purchases,
              ...(data?.orders?.purchases || {}),
              byStatus: {
                ...DEFAULT_STATS.orders.purchases.byStatus,
                ...(data?.orders?.purchases?.byStatus || {})
              }
            },
            sales: {
              ...DEFAULT_STATS.orders.sales,
              ...(data?.orders?.sales || {}),
              byStatus: {
                ...DEFAULT_STATS.orders.sales.byStatus,
                ...(data?.orders?.sales?.byStatus || {})
              }
            }
          }
        }));
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || err.message || 'Impossible de charger les statistiques.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      if (!user) {
        setSearchHistory([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const { data } = await api.get('/users/search-history');
        if (!mounted) return;
        setSearchHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setSearchHistory([]);
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [user]);

  const followedShops = useMemo(
    () => (Array.isArray(stats.followedShops) ? stats.followedShops : []),
    [stats.followedShops]
  );

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!showOrdersModal) return;
    let active = true;

    const loadOrderedProducts = async () => {
      setOrderedLoading(true);
      setOrderedError('');
      try {
        const { data } = await api.get('/orders?limit=100');
        if (!active) return;
        const orders = Array.isArray(data) ? data : data?.items || [];
        const productMap = new Map();

        orders.forEach((order) => {
          const items = Array.isArray(order.items) ? order.items : [];
          items.forEach((item) => {
            const productId = item.product?._id || item.product || '';
            const title = item.snapshot?.title || item.product?.title || 'Produit';
            const key = productId || title;
            const quantity = Number(item.quantity || 1);
            const price = Number(item.snapshot?.price || item.product?.price || 0);
            const lineTotal = price * quantity;
            const existing = productMap.get(key);
            if (existing) {
              existing.quantity += quantity;
              existing.totalSpent += lineTotal;
              return;
            }
            productMap.set(key, {
              key,
              product: item.product || null,
              title,
              image: item.snapshot?.image || item.product?.images?.[0] || null,
              quantity,
              totalSpent: lineTotal
            });
          });
        });

        const list = Array.from(productMap.values()).sort(
          (a, b) => b.totalSpent - a.totalSpent
        );
        setOrderedProducts(list);
      } catch (err) {
        if (!active) return;
        setOrderedError(
          err.response?.data?.message || 'Impossible de charger les produits commandés.'
        );
        setOrderedProducts([]);
      } finally {
        if (active) {
          setOrderedLoading(false);
        }
      }
    };

    loadOrderedProducts();
    return () => {
      active = false;
    };
  }, [showOrdersModal]);

  useEffect(() => {
    if (!showSalesModal) return;
    let active = true;

    const loadSoldProducts = async () => {
      setSoldLoading(true);
      setSoldError('');
      try {
        const { data } = await api.get('/orders/seller?limit=100');
        if (!active) return;
        const orders = Array.isArray(data) ? data : data?.items || [];
        const productMap = new Map();

        orders.forEach((order) => {
          const items = Array.isArray(order.items) ? order.items : [];
          items.forEach((item) => {
            const productId = item.product?._id || item.product || '';
            const title = item.snapshot?.title || item.product?.title || 'Produit';
            const key = productId || title;
            const quantity = Number(item.quantity || 1);
            const price = Number(item.snapshot?.price || item.product?.price || 0);
            const lineTotal = price * quantity;
            const existing = productMap.get(key);
            if (existing) {
              existing.quantity += quantity;
              existing.totalEarned += lineTotal;
              return;
            }
            productMap.set(key, {
              key,
              product: item.product || null,
              title,
              image: item.snapshot?.image || item.product?.images?.[0] || null,
              quantity,
              totalEarned: lineTotal
            });
          });
        });

        const list = Array.from(productMap.values()).sort(
          (a, b) => b.totalEarned - a.totalEarned
        );
        setSoldProducts(list);
      } catch (err) {
        if (!active) return;
        setSoldError(
          err.response?.data?.message || 'Impossible de charger les produits vendus.'
        );
        setSoldProducts([]);
      } finally {
        if (active) {
          setSoldLoading(false);
        }
      }
    };

    loadSoldProducts();
    return () => {
      active = false;
    };
  }, [showSalesModal]);

  const categoryMax = useMemo(() => {
    return stats.breakdown.categories.reduce((max, item) => Math.max(max, item.count || 0), 0) || 1;
  }, [stats.breakdown.categories]);

  const timeline = useMemo(() => stats.timeline || [], [stats.timeline]);
  const purchaseStats = useMemo(
    () => stats.orders?.purchases || DEFAULT_STATS.orders.purchases,
    [stats.orders]
  );
  const salesStats = useMemo(
    () => stats.orders?.sales || DEFAULT_STATS.orders.sales,
    [stats.orders]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Accès aux statistiques</h1>
            <p className="text-gray-600">Connectez-vous pour visualiser vos performances et insights personnalisés.</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="space-y-8">
            {/* Header skeleton */}
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded-xl w-64 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-lg w-96 animate-pulse"></div>
            </div>
            {/* Cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur de chargement</h2>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-wide">Tableau de bord</p>
                  <h1 className="text-3xl font-bold">Statistiques & Performance</h1>
                </div>
              </div>
              <p className="text-white/90 text-sm max-w-2xl">
                Analysez vos performances, suivez votre croissance et optimisez votre présence sur HDMarket.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/my"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
              >
                <Package className="w-4 h-4" />
                Mes annonces
              </Link>
              {userShopLink && (
                <Link
                  to={userShopLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
                >
                  <Store className="w-4 h-4" />
                  Ma boutique
                </Link>
              )}
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-indigo-600 px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition-all shadow-lg"
              >
                <Users className="w-4 h-4" />
                Mon profil
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-12">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Package}
            label="Annonces totales"
            value={formatNumber(stats.listings.total)}
            subtitle={`${formatNumber(stats.listings.approved)} approuvées`}
            gradient="bg-indigo-600"
            iconBg="bg-indigo-600"
          />
          <StatCard
            icon={Heart}
            label="Favoris reçus"
            value={formatNumber(stats.engagement.favoritesReceived)}
            subtitle={`${formatNumber(stats.engagement.commentsReceived)} commentaires`}
            gradient="bg-pink-600"
            iconBg="bg-pink-600"
          />
          <StatCard
            icon={Eye}
            label="Vues totales"
            value={formatNumber(stats.performance.views)}
            subtitle={`${formatNumber(stats.performance.clicks)} clics WhatsApp`}
            gradient="bg-purple-600"
            iconBg="bg-purple-600"
          />
          <StatCard
            icon={DollarSign}
            label="Budget annonces"
            value={formatCurrency(stats.advertismentSpend)}
            subtitle="Total des frais confirmés"
            gradient="bg-emerald-600"
            iconBg="bg-emerald-600"
          />
        </div>

        {/* Orders & Sales Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Purchases */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-indigo-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Mes commandes</h2>
                    <p className="text-sm text-gray-600">{formatNumber(purchaseStats.totalCount)} commande(s)</p>
                  </div>
                </div>
                {purchaseStats.totalItems > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOrdersModal(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Voir détails
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <MetricCard
                  title="Total dépensé"
                  value={formatCurrency(purchaseStats.totalAmount)}
                  icon={DollarSign}
                  color="indigo"
                />
                <MetricCard
                  title="Acompte versé"
                  value={formatCurrency(purchaseStats.paidAmount)}
                  icon={CheckCircle}
                  color="emerald"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  title="Reste à payer"
                  value={formatCurrency(purchaseStats.remainingAmount)}
                  icon={Target}
                  color="amber"
                />
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Statuts</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>En attente:</span>
                      <span className="font-semibold">{formatNumber(purchaseStats.byStatus?.pending?.count || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confirmées:</span>
                      <span className="font-semibold">{formatNumber(purchaseStats.byStatus?.confirmed?.count || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>En cours:</span>
                      <span className="font-semibold">{formatNumber(purchaseStats.byStatus?.delivering?.count || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Livrées:</span>
                      <span className="font-semibold">{formatNumber(purchaseStats.byStatus?.delivered?.count || 0)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                      <span className="text-red-600">Annulées:</span>
                      <span className="font-semibold text-red-600">{formatNumber(purchaseStats.byStatus?.cancelled?.count || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-emerald-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Mes ventes</h2>
                    <p className="text-sm text-gray-600">{formatNumber(salesStats.totalCount)} commande(s)</p>
                  </div>
                </div>
                {salesStats.totalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSalesModal(true)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    Voir détails
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <MetricCard
                  title="Gains estimés"
                  value={formatCurrency(salesStats.totalAmount)}
                  icon={DollarSign}
                  color="emerald"
                />
                <MetricCard
                  title="Commandes"
                  value={formatNumber(salesStats.totalCount)}
                  icon={Package}
                  color="purple"
                />
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Répartition par statut</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white">
                    <span className="text-gray-600">En attente</span>
                    <span className="font-bold text-gray-900">{formatNumber(salesStats.byStatus?.pending?.count || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white">
                    <span className="text-gray-600">Confirmées</span>
                    <span className="font-bold text-gray-900">{formatNumber(salesStats.byStatus?.confirmed?.count || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white">
                    <span className="text-gray-600">En cours</span>
                    <span className="font-bold text-gray-900">{formatNumber(salesStats.byStatus?.delivering?.count || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white">
                    <span className="text-gray-600">Livrées</span>
                    <span className="font-bold text-gray-900">{formatNumber(salesStats.byStatus?.delivered?.count || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-200 col-span-2">
                    <span className="text-red-600 font-semibold">Annulées</span>
                    <span className="font-bold text-red-700">{formatNumber(salesStats.byStatus?.cancelled?.count || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement & Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Followed Shops */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-purple-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-600">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Boutiques suivies</h2>
                    <p className="text-sm text-gray-600">{formatNumber(stats.engagement.shopsFollowed)} boutique(s)</p>
                  </div>
                </div>
                {followedShops.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFollowedModal(true)}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Voir toutes
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((item) => (
                    <div key={item} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : followedShops.length ? (
                <div className="space-y-3">
                  {followedShops.slice(0, 3).map((shop) => (
                    <Link
                      key={shop._id || shop.id}
                      to={buildShopPath(shop)}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-purple-200 hover:bg-purple-50/50 transition-all group"
                    >
                      <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                        {shop.shopLogo ? (
                          <img src={shop.shopLogo} alt={shop.shopName || shop.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold">
                            {(shop.shopName || shop.name)?.charAt(0) || 'B'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">{shop.shopName || shop.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(shop.followersCount || 0)} abonné(s)
                        </p>
                      </div>
                      {shop.shopVerified && (
                        <Award className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      )}
                    </Link>
                  ))}
                  {followedShops.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowFollowedModal(true)}
                      className="w-full text-center text-sm font-semibold text-purple-600 hover:text-purple-700 py-2"
                    >
                      Voir {followedShops.length - 3} autre(s) boutique(s)
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">Aucune boutique suivie</p>
                  <Link
                    to="/shops/verified"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700"
                  >
                    Explorer les boutiques
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Performance</h2>
                  <p className="text-sm text-gray-600">Indicateurs clés</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  title="Taux de conversion"
                  value={`${stats.performance.conversion}%`}
                  subtitle="Basé sur vos annonces"
                  icon={Target}
                  color="blue"
                />
                <MetricCard
                  title="Commentaires"
                  value={formatNumber(stats.engagement.commentsReceived)}
                  subtitle="Interactions clients"
                  icon={MessageCircle}
                  color="purple"
                />
                <MetricCard
                  title="Favoris sauvegardés"
                  value={formatNumber(stats.engagement.favoritesSaved)}
                  subtitle="Dans votre liste"
                  icon={Heart}
                  color="rose"
                />
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-amber-600">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Statut annonces</p>
                  <p className="text-sm text-gray-600">
                    {formatNumber(stats.listings.pending)} en attente
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatNumber(stats.listings.rejected)} rejetées
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories & Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Categories */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-indigo-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Catégories actives</h2>
                  <p className="text-sm text-gray-600">Répartition de vos annonces</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {stats.breakdown.categories.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Publiez des annonces pour voir vos catégories</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.breakdown.categories.map((cat) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-900 capitalize">{cat.category}</span>
                        <span className="text-gray-600 font-bold">{formatNumber(cat.count)}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                          style={{ width: `${Math.min((cat.count / categoryMax) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-pink-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-600">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Activité mensuelle</h2>
                  <p className="text-sm text-gray-600">Publications récentes</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {timeline.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Publiez vos premières annonces</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {timeline.map((item) => (
                    <div key={`${item.year}-${item.month}`} className="rounded-xl border border-gray-100 bg-white p-4 text-center hover:border-pink-200 transition-colors">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{item.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mb-1">{formatNumber(item.count)}</p>
                      <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-pink-500" />
                          {formatNumber(item.favorites)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-green-500" />
                          {formatNumber(item.clicks)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products */}
        {stats.topProducts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-600">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Meilleures annonces</h2>
                  <p className="text-sm text-gray-600">Vos produits les plus performants</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {stats.topProducts.map((product, index) => (
                  <div
                    key={product._id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
                        #{index + 1}
                      </div>
                    </div>
                    <img
                      src={product.image || '/api/placeholder/80/80'}
                      alt={product.title}
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        to={buildProductPath(product)}
                        className="font-semibold text-gray-900 hover:text-amber-600 transition-colors block truncate"
                      >
                        {product.title}
                      </Link>
                      <p className="text-sm text-gray-500 capitalize truncate">{product.category || 'Sans catégorie'}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">
                        {formatCurrency(product.price || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-pink-600">
                        <Heart className="w-4 h-4" />
                        <span className="font-semibold">{formatNumber(product.favorites)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-semibold">{formatNumber(product.whatsappClicks)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Followed Shops Modal */}
      {showFollowedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
            onClick={() => setShowFollowedModal(false)}
          />
          <div
            className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-gray-100 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-purple-600 text-white px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Boutiques suivies</p>
                    <h3 className="text-xl font-bold mt-1">
                      {followedShops.length ? `${followedShops.length} boutique(s)` : 'Aucune boutique suivie'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFollowedModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : followedShops.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {followedShops.map((shop) => (
                    <Link
                      key={shop._id || shop.id}
                      to={buildShopPath(shop)}
                      className="group flex items-center gap-4 rounded-xl border-2 border-gray-100 bg-white p-4 hover:border-purple-300 hover:shadow-lg transition-all duration-200"
                      onClick={() => setShowFollowedModal(false)}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden ring-2 ring-gray-100 group-hover:ring-purple-200 transition-all">
                          {shop.shopLogo ? (
                            <img src={shop.shopLogo} alt={shop.shopName || shop.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-purple-100 flex items-center justify-center text-purple-600 text-lg font-bold">
                              {(shop.shopName || shop.name)?.charAt(0) || 'B'}
                            </div>
                          )}
                        </div>
                        {shop.shopVerified && (
                          <div className="absolute -top-1 -right-1 p-1 bg-white rounded-full shadow-md">
                            <Award className="w-4 h-4 text-emerald-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate group-hover:text-purple-600 transition-colors">{shop.shopName || shop.name}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {shop.city && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">{shop.city}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-400" />
                            <p className="text-xs text-gray-500">
                              {formatNumber(shop.followersCount || 0)} abonné(s)
                            </p>
                          </div>
                        </div>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-gray-300 group-hover:text-purple-600 rotate-180 transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
                    <Store className="w-10 h-10 text-purple-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Aucune boutique suivie</h4>
                  <p className="text-sm text-gray-500 mb-6">Commencez à suivre vos boutiques préférées pour les retrouver facilement</p>
                  <Link
                    to="/shops/verified"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setShowFollowedModal(false)}
                  >
                    <Store className="w-4 h-4" />
                    Explorer les boutiques
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ordered Products Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
            onClick={() => setShowOrdersModal(false)}
          />
          <div
            className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-gray-100 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Produits commandés</p>
                    <h3 className="text-xl font-bold mt-1">
                      {purchaseStats.totalItems
                        ? `${formatNumber(purchaseStats.totalItems)} produit(s)`
                        : 'Aucun produit commandé'}
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      Total dépensé: {formatCurrency(purchaseStats.totalAmount)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrdersModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {orderedLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : orderedError ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Erreur de chargement</h4>
                  <p className="text-sm text-red-600">{orderedError}</p>
                </div>
              ) : orderedProducts.length ? (
                <div className="space-y-3">
                  {orderedProducts.map((product, index) => {
                    const content = (
                      <div className="group flex items-center gap-4 rounded-xl border-2 border-gray-100 bg-white p-4 hover:border-indigo-300 hover:shadow-lg transition-all duration-200">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            #{index + 1}
                          </div>
                        </div>
                        <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 ring-2 ring-gray-100 group-hover:ring-indigo-200 transition-all">
                          {product.image ? (
                            <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold">
                              {product.title?.charAt(0) || 'P'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{product.title}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {formatNumber(product.quantity)} article(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(product.totalSpent)}
                            </span>
                          </div>
                        </div>
                        {product.product && (
                          <ArrowLeft className="w-5 h-5 text-gray-300 group-hover:text-indigo-600 rotate-180 transition-colors flex-shrink-0" />
                        )}
                      </div>
                    );

                    if (!product.product) {
                      return <div key={product.key}>{content}</div>;
                    }

                    return (
                      <Link
                        key={product.key}
                        to={buildProductPath(product.product)}
                        className="block"
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Aucun produit commandé</h4>
                  <p className="text-sm text-gray-500 mb-6">Vos produits commandés apparaîtront ici</p>
                  <Link
                    to="/orders"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setShowOrdersModal(false)}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Voir mes commandes
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sold Products Modal */}
      {showSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
            onClick={() => setShowSalesModal(false)}
          />
          <div
            className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-gray-100 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Produits vendus</p>
                    <h3 className="text-xl font-bold mt-1">
                      {salesStats.totalCount
                        ? `${formatNumber(salesStats.totalCount)} commande(s)`
                        : 'Aucune vente'}
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      Gains estimés: {formatCurrency(salesStats.totalAmount)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSalesModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {soldLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : soldError ? (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Erreur de chargement</h4>
                  <p className="text-sm text-red-600">{soldError}</p>
                </div>
              ) : soldProducts.length ? (
                <div className="space-y-3">
                  {soldProducts.map((product, index) => {
                    const content = (
                      <div className="group flex items-center gap-4 rounded-xl border-2 border-gray-100 bg-white p-4 hover:border-emerald-300 hover:shadow-lg transition-all duration-200">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                            #{index + 1}
                          </div>
                        </div>
                        <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 ring-2 ring-gray-100 group-hover:ring-emerald-200 transition-all">
                          {product.image ? (
                            <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-bold">
                              {product.title?.charAt(0) || 'P'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">{product.title}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {formatNumber(product.quantity)} article(s)
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-emerald-600">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(product.totalEarned)}
                            </span>
                          </div>
                        </div>
                        {product.product && (
                          <ArrowLeft className="w-5 h-5 text-gray-300 group-hover:text-emerald-600 rotate-180 transition-colors flex-shrink-0" />
                        )}
                      </div>
                    );

                    if (!product.product) {
                      return <div key={product.key}>{content}</div>;
                    }

                    return (
                      <Link
                        key={product.key}
                        to={buildProductPath(product.product)}
                        className="block"
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                    <TrendingUp className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">Aucun produit vendu</h4>
                  <p className="text-sm text-gray-500 mb-6">Vos produits vendus apparaîtront ici une fois que vous recevrez des commandes</p>
                  <Link
                    to="/seller/orders"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => setShowSalesModal(false)}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Voir mes ventes
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
