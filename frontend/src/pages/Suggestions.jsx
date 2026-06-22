import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  ShoppingBag,
  ArrowRight,
  Filter,
  Zap,
  Star,
  Clock,
  Target,
  Award,
  RefreshCw,
  AlertCircle,
  Search,
  CheckCircle
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import { buildCategoryPreferences, fetchRecentProductViews, loadRecentProductViews } from '../utils/recentViews';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 12;
const MAX_CATEGORIES = 4;

const buildVisitedIdSet = (views) =>
  new Set(views.map((entry) => String(entry?.id)).filter(Boolean));

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return parsed.toLocaleString('fr-FR');
};

const CATEGORY_LABELS = {
  'Électronique': 'Électronique',
  'Mode & Accessoires': 'Mode',
  'Maison & Jardin': 'Maison',
  'Véhicules': 'Véhicules',
  'Sports & Loisirs': 'Sports',
  'Services': 'Services',
  'Autre': 'Autre'
};

export default function Suggestions() {
  const isMobileView = useIsMobile();
  const externalLinkProps = useDesktopExternalLink();
  const { user } = useContext(AuthContext);
  const [views, setViews] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryPages, setCategoryPages] = useState({});
  const [categoryDone, setCategoryDone] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const loadViews = async () => {
      if (!user) {
        if (active) setViews(loadRecentProductViews());
        return;
      }
      try {
        const remote = await fetchRecentProductViews();
        if (active) {
          setViews(remote.length ? remote : loadRecentProductViews());
        }
      } catch (error) {
        if (active) setViews(loadRecentProductViews());
      }
    };
    loadViews();
    return () => {
      active = false;
    };
  }, [user]);

  const preferredCategories = useMemo(
    () => buildCategoryPreferences(views, MAX_CATEGORIES),
    [views]
  );

  const visitedIds = useMemo(() => buildVisitedIdSet(views), [views]);
  const currentUserId = user?._id || user?.id || null;

  useEffect(() => {
    setItems([]);
    setError('');
    setCategoryPages({});
    setCategoryDone({});
    setHasMore(preferredCategories.length > 0);
  }, [preferredCategories]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    if (!preferredCategories.length) return;
    setLoading(true);
    setError('');

    const existingIds = new Set(items.map((item) => String(item?._id)));
    const nextPages = { ...categoryPages };
    const nextDone = { ...categoryDone };
    const collected = [];

    for (const category of preferredCategories) {
      if (collected.length >= PAGE_SIZE) break;
      if (nextDone[category]) continue;

      const page = nextPages[category] || 1;
      try {
        const { data } = await api.get('/products/public', {
          params: {
            category,
            page,
            limit: PAGE_SIZE,
            sort: 'new'
          }
        });
        const responseItems = Array.isArray(data) ? data : data?.items || [];
        const totalPages = Array.isArray(data) ? 1 : data?.pagination?.pages || 1;

        responseItems.forEach((item) => {
          if (collected.length >= PAGE_SIZE) return;
          if (!item?._id) return;
          const id = String(item._id);
          const ownerId = item.user?._id || item.user?.id || item.user;
          if (currentUserId && ownerId && String(ownerId) === String(currentUserId)) return;
          if (visitedIds.has(id)) return;
          if (existingIds.has(id)) return;
          if (collected.some((entry) => String(entry._id) === id)) return;
          collected.push(item);
        });

        if (page >= totalPages) {
          nextDone[category] = true;
        } else {
          nextPages[category] = page + 1;
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Erreur de chargement.');
        break;
      }
    }

    setItems((prev) => [...prev, ...collected]);
    setCategoryPages(nextPages);
    setCategoryDone(nextDone);

    const hasRemaining = preferredCategories.some((category) => !nextDone[category]);
    if (!hasRemaining) {
      setHasMore(false);
    }
    setLoading(false);
  }, [
    loading,
    hasMore,
    preferredCategories,
    items,
    categoryPages,
    categoryDone,
    visitedIds,
    currentUserId
  ]);

  useEffect(() => {
    if (!preferredCategories.length) return;
    loadMore();
  }, [preferredCategories, loadMore]);

  useEffect(() => {
    if (!isMobileView) return;
    if (loading) return;
    if (!hasMore) return;
    const handleScroll = () => {
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileView, loading, hasMore, loadMore]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setItems([]);
    setCategoryPages({});
    setCategoryDone({});
    setHasMore(true);
    setError('');
    
    // Reload views
    if (user) {
      try {
        const remote = await fetchRecentProductViews();
        setViews(remote.length ? remote : loadRecentProductViews());
      } catch {
        setViews(loadRecentProductViews());
      }
    } else {
      setViews(loadRecentProductViews());
    }
    
    setRefreshing(false);
  };

  const categoryStats = useMemo(() => {
    const stats = {};
    preferredCategories.forEach((cat) => {
      const categoryItems = items.filter((item) => item.category === cat);
      stats[cat] = categoryItems.length;
    });
    return stats;
  }, [preferredCategories, items]);

  if (loading && items.length === 0) {
    return (
      <div className="hd-products-flow min-h-screen">
        <div className="max-w-7xl mx-auto px-3 py-6 pb-24 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="hd-products-hero rounded-2xl p-5 sm:p-7">
              <div className="h-7 w-56 animate-pulse rounded-full bg-white/25" />
              <div className="mt-4 h-10 w-72 max-w-full animate-pulse rounded-2xl bg-white/20" />
              <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-white/20" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-products-flow min-h-screen">
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 pb-24 sm:space-y-7 sm:px-6 sm:py-8 lg:px-8 md:pb-16">
        <header className="hd-products-hero rounded-2xl p-5 text-white shadow-[0_18px_46px_rgba(255,106,0,0.14)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white ring-1 ring-white/20">
                <Sparkles className="h-3.5 w-3.5" />
                Suggestions personnalisées
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">Découvrez pour vous</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/86">
                Des produits sélectionnés spécialement pour vous, basés sur vos recherches et consultations récentes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/28 bg-white/16 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/24 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </header>

        {/* Statistics Cards */}
        {views.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-950">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 sm:text-2xl">{formatNumber(views.length)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 sm:text-sm">Consultés</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Vos vues récentes</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF6A00]">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 sm:text-2xl">{formatNumber(preferredCategories.length)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 sm:text-sm">Catégories</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Basé sur vos intérêts</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 sm:text-2xl">{formatNumber(items.length)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 sm:text-sm">Suggestions</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Produits recommandés</p>
            </div>
          </div>
        )}

        {/* Category Badges */}
        {preferredCategories.length > 0 && (
          <div className="hd-products-toolbar rounded-2xl p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-[#FF6A00]" />
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Catégories suggérées</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferredCategories.map((category) => (
                <div
                  key={category}
                  className="hd-products-chip inline-flex items-center gap-2 rounded-full px-4 py-2"
                >
                  <TrendingUp className="w-4 h-4 text-[#FF6A00]" />
                  <span className="text-sm font-black text-gray-800">{CATEGORY_LABELS[category] || category}</span>
                  {categoryStats[category] > 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-black text-gray-500">
                      {categoryStats[category]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Erreur de chargement</h3>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - No Views */}
        {!preferredCategories.length && !loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(117,75,36,0.08)] sm:p-12">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 ring-1 ring-gray-200">
              <Search className="w-10 h-10 text-[#FF6A00]" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Aucune suggestion disponible</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Consultez quelques produits pour obtenir des suggestions personnalisées basées sur vos intérêts.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/products"
                className="hd-primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-black"
              >
                <ShoppingBag className="w-4 h-4" />
                Explorer les produits
              </Link>
              <Link
                to="/shops/verified"
                className="hd-products-chip inline-flex items-center gap-2 rounded-full px-6 py-3 font-black"
              >
                <Award className="w-4 h-4" />
                Boutiques vérifiées
              </Link>
            </div>
          </div>
        )}

        {/* Empty State - No Items but has Categories */}
        {!loading && items.length === 0 && preferredCategories.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(117,75,36,0.08)] sm:p-12">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 ring-1 ring-gray-200">
              <Zap className="w-10 h-10 text-[#FF6A00]" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Aucune suggestion disponible</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Nous avons analysé vos préférences, mais aucun nouveau produit ne correspond à vos critères pour le moment.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="hd-primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-black"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser les suggestions
            </button>
          </div>
        )}

        {/* Products Grid */}
        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900">Produits recommandés</h2>
                <p className="text-sm font-semibold text-gray-500 mt-1">
                  {items.length} produit{items.length > 1 ? 's' : ''} suggéré{items.length > 1 ? 's' : ''} pour vous
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((product) => (
                <ProductCard key={product._id} p={product} />
              ))}
            </div>
          </>
        )}

        {/* Loading More */}
        {loading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" />
            ))}
          </div>
        )}

        {/* Load More Button (Desktop) */}
        {!isMobileView && hasMore && !loading && items.length > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="hd-primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-black"
            >
              <ArrowRight className="w-4 h-4" />
              Charger plus de suggestions
            </button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && items.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Toutes les suggestions ont été chargées</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
