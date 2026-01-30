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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="space-y-8">
            {/* Header skeleton */}
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded-xl w-64 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-lg w-96 animate-pulse"></div>
            </div>
            {/* Cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-80 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
              ))}
            </div>
          </div>
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
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-wide">Suggestions personnalisées</p>
                  <h1 className="text-3xl font-bold">Découvrez pour vous</h1>
                </div>
              </div>
              <p className="text-white/90 text-sm max-w-2xl">
                Des produits sélectionnés spécialement pour vous, basés sur vos recherches et consultations récentes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-12">
        {/* Statistics Cards */}
        {views.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-indigo-600">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatNumber(views.length)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Produits consultés</p>
              <p className="text-xs text-gray-500 mt-1">Vos vues récentes</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-purple-600">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatNumber(preferredCategories.length)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Catégories préférées</p>
              <p className="text-xs text-gray-500 mt-1">Basé sur vos intérêts</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-emerald-600">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{formatNumber(items.length)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Suggestions</p>
              <p className="text-xs text-gray-500 mt-1">Produits recommandés</p>
            </div>
          </div>
        )}

        {/* Category Badges */}
        {preferredCategories.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Catégories suggérées</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferredCategories.map((category) => (
                <div
                  key={category}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200"
                >
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-700">{CATEGORY_LABELS[category] || category}</span>
                  {categoryStats[category] > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
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
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune suggestion disponible</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Consultez quelques produits pour obtenir des suggestions personnalisées basées sur vos intérêts.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                Explorer les produits
              </Link>
              <Link
                to="/shops/verified"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-indigo-200 bg-white text-indigo-600 font-semibold hover:bg-indigo-50 transition-all"
              >
                <Award className="w-4 h-4" />
                Boutiques vérifiées
              </Link>
            </div>
          </div>
        )}

        {/* Empty State - No Items but has Categories */}
        {!loading && items.length === 0 && preferredCategories.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
              <Zap className="w-10 h-10 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucune suggestion disponible</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Nous avons analysé vos préférences, mais aucun nouveau produit ne correspond à vos critères pour le moment.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser les suggestions
            </button>
          </div>
        )}

        {/* Products Grid */}
        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Produits recommandés</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {items.length} produit{items.length > 1 ? 's' : ''} suggéré{items.length > 1 ? 's' : ''} pour vous
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((product) => (
                <ProductCard key={product._id} p={product} />
              ))}
            </div>
          </>
        )}

        {/* Loading More */}
        {loading && items.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-white rounded-2xl border border-gray-100 animate-pulse"></div>
            ))}
          </div>
        )}

        {/* Load More Button (Desktop) */}
        {!isMobileView && hasMore && !loading && items.length > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              <ArrowRight className="w-4 h-4" />
              Charger plus de suggestions
            </button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && items.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Toutes les suggestions ont été chargées</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
