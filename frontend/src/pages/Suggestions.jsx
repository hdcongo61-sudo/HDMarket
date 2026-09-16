import { createSuggestionPager } from '../utils/suggestionPager';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowRightIcon, ArrowTrendingUpIcon, BoltIcon, CheckCircleIcon, ClockIcon, ExclamationCircleIcon, EyeIcon, FunnelIcon, HeartIcon, MagnifyingGlassIcon, ShoppingBagIcon, SparklesIcon, StarIcon, TrophyIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { buildCategoryPreferences, fetchRecentProductViews, loadRecentProductViews } from '../utils/recentViews';
import ProductMasonryGrid from '../components/ProductMasonryGrid';

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
  const { user, loading: authLoading } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id || null;
  const [views, setViews] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef(null);
  const preferredCategories = useMemo(() => buildCategoryPreferences(views, MAX_CATEGORIES), [views]);

  const loadMore = useCallback(async () => {
    const request = requestRef.current;
    if (!request || request.busy || request.controller.signal.aborted || !request.hasMore) return;
    request.busy = true;
    setLoading(true);
    setError('');
    try {
      const result = await request.next(request.controller.signal);
      if (requestRef.current !== request || request.controller.signal.aborted) return;
      request.hasMore = result.hasMore;
      setItems(previous => [...previous, ...result.items]);
      setHasMore(result.hasMore);
    } catch (err) {
      if (request.controller.signal.aborted || requestRef.current !== request) return;
      setError(err.response?.data?.message || 'Impossible de charger les suggestions. Réessayez.');
    } finally {
      request.busy = false;
      if (requestRef.current === request && !request.controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setItems([]);
    setViews([]);
    setError('');
    setHistoryLoading(true);
    setLoading(true);
    setHasMore(false);
    if (authLoading) return;
    const controller = new AbortController();
    const initialize = async () => {
      let history = loadRecentProductViews(currentUserId);
      if (currentUserId) {
        try {
          const remote = await fetchRecentProductViews(50, { signal: controller.signal });
          history = remote.length ? remote : history;
        } catch { /* Only this account's local history is a valid fallback. */ }
      }
      if (controller.signal.aborted) return;
      setViews(history);
      setHistoryLoading(false);
      const next = createSuggestionPager({
        categories: buildCategoryPreferences(history, MAX_CATEGORIES),
        visitedIds: buildVisitedIdSet(history), userId: currentUserId, pageSize: PAGE_SIZE,
        fetchPage: async ({ signal, ...params }) => (await api.get('/products/public', { params, signal, skipCache: true })).data
      });
      requestRef.current = { controller, next, busy: false, hasMore: true };
      await loadMore();
    };
    initialize();
    return () => controller.abort();
  }, [currentUserId, authLoading, refreshKey, loadMore]);

  const handleRefresh = () => {
    requestRef.current?.controller.abort();
    setRefreshKey(value => value + 1);
  };

  const categoryStats = useMemo(() => {
    const stats = {};
    preferredCategories.forEach((cat) => {
      const categoryItems = items.filter((item) => item.category === cat);
      stats[cat] = categoryItems.length;
    });
    return stats;
  }, [preferredCategories, items]);

  if ((authLoading || historyLoading || loading) && items.length === 0) {
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
        <header className="hd-products-hero rounded-2xl p-5 text-white shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white ring-1 ring-white/20">
                <SparklesIcon className="h-3.5 w-3.5" />
                Suggestions personnalisées
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">Découvrez pour vous</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/86">
                {preferredCategories.length ? 'Des produits sélectionnés selon vos consultations récentes.' : 'Découvrez les produits populaires pour commencer.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={historyLoading || loading}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/28 bg-white/16 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/24 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
                  <EyeIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 sm:text-2xl">{formatNumber(views.length)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 sm:text-sm">Consultés</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Vos vues récentes</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e85d00]">
                  <ViewfinderCircleIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black text-gray-900 sm:text-2xl">{formatNumber(preferredCategories.length)}</span>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-700 sm:text-sm">Catégories</p>
              <p className="mt-1 hidden text-xs text-gray-500 sm:block">Basé sur vos intérêts</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700">
                  <ShoppingBagIcon className="w-5 h-5 text-white" />
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
              <FunnelIcon className="w-4 h-4 text-[#e85d00]" />
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Catégories suggérées</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {preferredCategories.map((category) => (
                <div
                  key={category}
                  className="hd-products-chip inline-flex items-center gap-2 rounded-full px-4 py-2"
                >
                  <ArrowTrendingUpIcon className="w-4 h-4 text-[#e85d00]" />
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
              <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800 mb-1">Erreur de chargement</h3>
                <p className="text-sm text-red-600">{error}</p>
                <button type="button" onClick={loadMore} className="mt-3 font-bold underline">Réessayer</button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State - No Items but has Categories */}
        {!loading && !historyLoading && !error && items.length === 0 && !hasMore && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 ring-1 ring-gray-200">
              <BoltIcon className="w-10 h-10 text-[#e85d00]" />
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
              <ArrowPathIcon className="w-4 h-4" />
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
            <ProductMasonryGrid products={items} />
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

        {/* Explicit pagination is available on every screen size. */}
        {hasMore && !loading && !error && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="hd-primary-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-black"
            >
              <ArrowRightIcon className="w-4 h-4" />
              Charger plus de suggestions
            </button>
          </div>
        )}

        {/* End of Results */}
        {!hasMore && items.length > 0 && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm">
              <CheckCircleIcon className="w-4 h-4" />
              <span>Toutes les suggestions ont été chargées</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
