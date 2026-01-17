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
  X
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
        delivered: { count: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, items: 0 }
      }
    },
    sales: {
      totalCount: 0,
      totalAmount: 0,
      byStatus: {
        pending: { count: 0, totalAmount: 0 },
        confirmed: { count: 0, totalAmount: 0 },
        delivering: { count: 0, totalAmount: 0 },
        delivered: { count: 0, totalAmount: 0 }
      }
    }
  }
};

const SummaryCard = ({ icon: Icon, label, value, accent }) => (
  <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${accent} shadow-lg`}>
    <div className="flex items-center justify-between mb-3">
      <div className="rounded-xl bg-white/20 p-2">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold">{formatNumber(value)}</span>
    </div>
    <p className="text-sm text-white/90 font-medium">{label}</p>
  </div>
);

export default function UserStats() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [followedShops, setFollowedShops] = useState([]);
  const [followedLoading, setFollowedLoading] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    const loadFollowed = async () => {
      if (!user) {
        setFollowedShops([]);
        return;
      }
      setFollowedLoading(true);
      try {
        const { data } = await api.get('/users/shops/following');
        if (!mounted) return;
        setFollowedShops(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setFollowedShops([]);
      } finally {
        if (mounted) setFollowedLoading(false);
      }
    };
    loadFollowed();
    return () => {
      mounted = false;
    };
  }, [user]);

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
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connectez-vous pour voir vos statistiques</h1>
        <p className="text-gray-600 mb-6">Vos performances et insights personnalisés sont accessibles après authentification.</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">Analyse</p>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques de votre activité</h1>
          <p className="text-gray-600 text-sm">
            Suivez les performances de votre boutique et l'impact de vos publications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Link
            to="/my"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Package className="w-4 h-4" />
            Mes annonces
          </Link>
          {userShopLink && (
            <Link
              to={userShopLink}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Store className="w-4 h-4" />
              Ma boutique publique
            </Link>
          )}
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Store className="w-4 h-4" />
            Mon profil
          </Link>
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Budget annonces : {formatCurrency(stats.advertismentSpend)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="mx-auto h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 mt-4">Chargement des statistiques…</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Impossible de charger les données</h2>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Résumé */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard icon={Package} label="Annonces totales" value={stats.listings.total} accent="from-indigo-500 to-blue-600" />
            <SummaryCard icon={CheckCircle} label="Approuvées" value={stats.listings.approved} accent="from-emerald-500 to-green-600" />
            <SummaryCard icon={Heart} label="Favoris reçus" value={stats.engagement.favoritesReceived} accent="from-pink-500 to-rose-600" />
            <SummaryCard icon={MessageCircle} label="Contacts WhatsApp" value={stats.performance.clicks} accent="from-purple-500 to-indigo-600" />
            <SummaryCard icon={Store} label="Boutiques suivies" value={stats.engagement.shopsFollowed} accent="from-emerald-500 to-teal-600" />
            <div className="rounded-2xl p-5 bg-white border border-gray-100 flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-600">Dépenses annonces</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.advertismentSpend)}</p>
              <p className="text-xs text-gray-500">Total des frais confirmés pour vos publications.</p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-gray-500">Boutiques suivies</p>
                <h2 className="text-lg font-semibold text-gray-900">
                  {stats.engagement.shopsFollowed ? `${stats.engagement.shopsFollowed} boutique(s)` : 'Aucune boutique suivie'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {followedShops.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowFollowedModal(true)}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Voir toutes
                  </button>
                )}
                <Link
                  to="/shops/verified"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Explorer les boutiques
                </Link>
              </div>
            </div>
            {followedLoading ? (
              <div className="space-y-2">
                {[1, 2].map((item) => (
                  <div key={item} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : followedShops.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {followedShops.map((shop) => (
                  <Link
                    key={shop._id}
                    to={buildShopPath(shop)}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 hover:border-indigo-200 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden">
                      {shop.shopLogo ? (
                        <img src={shop.shopLogo} alt={shop.shopName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-500 text-sm font-semibold">
                          {shop.shopName?.charAt(0) || 'B'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{shop.shopName}</p>
                      <p className="text-xs text-gray-500">
                        {shop.followersCount?.toLocaleString('fr-FR') || 0} abonné(s)
                      </p>
                    </div>
                    {shop.shopVerified && (
                      <span className="text-emerald-600 text-xs font-semibold">Certifiée</span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Suivez des boutiques pour les retrouver facilement ici.</p>
            )}
          </div>

          {showFollowedModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setShowFollowedModal(false)}
              />
              <div
                className="relative w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Boutiques suivies</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {followedShops.length ? `${followedShops.length} boutique(s)` : 'Aucune boutique suivie'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFollowedModal(false)}
                    className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                {followedLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : followedShops.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {followedShops.map((shop) => (
                      <Link
                        key={shop._id}
                        to={buildShopPath(shop)}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 hover:border-indigo-200 transition-colors"
                        onClick={() => setShowFollowedModal(false)}
                      >
                        <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden">
                          {shop.shopLogo ? (
                            <img src={shop.shopLogo} alt={shop.shopName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-500 text-sm font-semibold">
                              {shop.shopName?.charAt(0) || 'B'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{shop.shopName}</p>
                          <p className="text-xs text-gray-500">
                            {shop.followersCount?.toLocaleString('fr-FR') || 0} abonné(s)
                          </p>
                        </div>
                        {shop.shopVerified && (
                          <span className="text-emerald-600 text-xs font-semibold">Certifiée</span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Suivez des boutiques pour les retrouver facilement ici.</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">Commandes</p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {purchaseStats.totalCount
                      ? `${formatNumber(purchaseStats.totalCount)} commande(s)`
                      : 'Aucune commande'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {purchaseStats.totalItems > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowOrdersModal(true)}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Produits commandés
                    </button>
                  )}
                  <span className="text-xs font-semibold text-indigo-600">Dépenses</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-indigo-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">
                    Total dépensé
                  </p>
                  <p className="text-lg font-bold text-indigo-700">
                    {formatCurrency(purchaseStats.totalAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                    Acompte versé
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatCurrency(purchaseStats.paidAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold">
                    Reste à payer
                  </p>
                  <p className="text-lg font-bold text-amber-700">
                    {formatCurrency(purchaseStats.remainingAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Statuts
                  </p>
                  <div className="mt-1 space-y-1 text-xs text-gray-600">
                    <p>En attente : {formatNumber(purchaseStats.byStatus?.pending?.count || 0)}</p>
                    <p>Confirmées : {formatNumber(purchaseStats.byStatus?.confirmed?.count || 0)}</p>
                    <p>En cours : {formatNumber(purchaseStats.byStatus?.delivering?.count || 0)}</p>
                    <p>Livrées : {formatNumber(purchaseStats.byStatus?.delivered?.count || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-gray-500">Ventes</p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {salesStats.totalCount
                      ? `${formatNumber(salesStats.totalCount)} commande(s)`
                      : 'Aucune vente'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {salesStats.totalCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSalesModal(true)}
                      className="text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      Produits vendus
                    </button>
                  )}
                  <span className="text-xs font-semibold text-emerald-600">Gains</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                    Gains estimés
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatCurrency(salesStats.totalAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Commandes reçues
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatNumber(salesStats.totalCount)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 p-3 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Statuts
                  </p>
                  <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                    <p>En attente : {formatNumber(salesStats.byStatus?.pending?.count || 0)}</p>
                    <p>Confirmées : {formatNumber(salesStats.byStatus?.confirmed?.count || 0)}</p>
                    <p>En cours : {formatNumber(salesStats.byStatus?.delivering?.count || 0)}</p>
                    <p>Livrées : {formatNumber(salesStats.byStatus?.delivered?.count || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showOrdersModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setShowOrdersModal(false)}
              />
              <div
                className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Produits commandés</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {purchaseStats.totalItems
                        ? `${formatNumber(purchaseStats.totalItems)} produit(s)`
                        : 'Aucun produit commandé'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOrdersModal(false)}
                    className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      En attente
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(purchaseStats.byStatus?.pending?.items || 0)} produit(s)
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Confirmées
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(purchaseStats.byStatus?.confirmed?.items || 0)} produit(s)
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      En cours de livraison
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(purchaseStats.byStatus?.delivering?.items || 0)} produit(s)
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Livrées
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(purchaseStats.byStatus?.delivered?.items || 0)} produit(s)
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Produits commandés
                    </p>
                    {orderedLoading ? (
                      <p className="text-sm text-gray-500 mt-2">Chargement...</p>
                    ) : orderedError ? (
                      <p className="text-sm text-red-600 mt-2">{orderedError}</p>
                    ) : orderedProducts.length ? (
                      <div className="mt-2 space-y-2">
                        {orderedProducts.map((product) => {
                          const content = (
                            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-2 hover:border-indigo-200 transition-colors">
                              <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden">
                                {product.image ? (
                                  <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-500 text-sm font-semibold">
                                    {product.title?.charAt(0) || 'P'}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{product.title}</p>
                                <p className="text-xs text-gray-500">
                                  {formatNumber(product.quantity)} article(s) · {formatCurrency(product.totalSpent)}
                                </p>
                              </div>
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
                      <p className="text-sm text-gray-500 mt-2">Aucun produit commandé.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showSalesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setShowSalesModal(false)}
              />
              <div
                className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl border border-gray-100 p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Produits vendus</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {salesStats.totalCount
                        ? `${formatNumber(salesStats.totalCount)} commande(s)`
                        : 'Aucune vente'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSalesModal(false)}
                    className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    aria-label="Fermer"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Statuts
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <p>En attente : {formatNumber(salesStats.byStatus?.pending?.count || 0)}</p>
                      <p>Confirmées : {formatNumber(salesStats.byStatus?.confirmed?.count || 0)}</p>
                      <p>En cours : {formatNumber(salesStats.byStatus?.delivering?.count || 0)}</p>
                      <p>Livrées : {formatNumber(salesStats.byStatus?.delivered?.count || 0)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                      Produits vendus
                    </p>
                    {soldLoading ? (
                      <p className="text-sm text-gray-500 mt-2">Chargement...</p>
                    ) : soldError ? (
                      <p className="text-sm text-red-600 mt-2">{soldError}</p>
                    ) : soldProducts.length ? (
                      <div className="mt-2 space-y-2">
                        {soldProducts.map((product) => {
                          const content = (
                            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-2 hover:border-emerald-200 transition-colors">
                              <div className="h-12 w-12 rounded-xl bg-gray-100 overflow-hidden">
                                {product.image ? (
                                  <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 text-sm font-semibold">
                                    {product.title?.charAt(0) || 'P'}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{product.title}</p>
                                <p className="text-xs text-gray-500">
                                  {formatNumber(product.quantity)} article(s) · {formatCurrency(product.totalEarned)}
                                </p>
                              </div>
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
                      <p className="text-sm text-gray-500 mt-2">Aucun produit vendu.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Catégories les plus actives</h2>
              </div>
              {stats.breakdown.categories.length === 0 ? (
                <p className="text-sm text-gray-500">Publiez des annonces pour voir vos catégories performantes.</p>
              ) : (
                <div className="space-y-3">
                  {stats.breakdown.categories.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="capitalize">{cat.category}</span>
                        <span className="font-semibold text-gray-900">{formatNumber(cat.count)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          style={{ width: `${(cat.count / categoryMax) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Performance globale</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                  <p className="text-xs uppercase text-green-800 font-semibold">Conversion estimée</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{stats.performance.conversion}%</p>
                  <p className="text-xs text-green-600 mt-1">Basé sur vos annonces approuvées</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs uppercase text-blue-800 font-semibold">Commentaires reçus</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{formatNumber(stats.engagement.commentsReceived)}</p>
                  <p className="text-xs text-blue-600 mt-1">Interactions clients</p>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                  <p className="text-xs uppercase text-purple-800 font-semibold">Favoris sauvegardés</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">{formatNumber(stats.engagement.favoritesSaved)}</p>
                  <p className="text-xs text-purple-600 mt-1">Dans votre liste personnelle</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs uppercase text-amber-800 font-semibold">Statut des annonces</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {formatNumber(stats.listings.pending)} en attente • {formatNumber(stats.listings.rejected)} rejetées
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Pensez à suivre vos dossiers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-semibold text-gray-900">Publications récentes</h2>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500">Publiez vos premières annonces pour voir l'activité mensuelle.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {timeline.map((item) => (
                  <div key={`${item.year}-${item.month}`} className="rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-xs uppercase text-gray-500">{item.label}</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(item.count)}</p>
                    <p className="text-[11px] text-gray-500">{formatNumber(item.favorites)} favoris • {formatNumber(item.clicks)} clics</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top products */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Meilleures annonces</h2>
            </div>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">Dès que vos annonces reçoivent des interactions, elles apparaîtront ici.</p>
            ) : (
              <div className="space-y-4">
                {stats.topProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={product.image || '/api/placeholder/80/80'}
                        alt={product.title}
                        className="w-16 h-16 rounded-xl object-cover border"
                      />
                      <div className="space-y-1">
                        <Link
                          to={buildProductPath(product)}
                          className="font-semibold text-gray-900 hover:text-indigo-600"
                        >
                          {product.title}
                        </Link>
                        <p className="text-sm text-gray-500 capitalize">{product.category || 'Sans catégorie'}</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {Number(product.price || 0).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1"><Heart className="w-4 h-4 text-pink-500" /> {formatNumber(product.favorites)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-4 h-4 text-green-500" /> {formatNumber(product.whatsappClicks)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
