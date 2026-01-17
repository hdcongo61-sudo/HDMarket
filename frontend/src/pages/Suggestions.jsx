import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import useIsMobile from '../hooks/useIsMobile';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import { buildCategoryPreferences, fetchRecentProductViews, loadRecentProductViews } from '../utils/recentViews';

const PAGE_SIZE = 12;
const MAX_CATEGORIES = 4;

const buildVisitedIdSet = (views) =>
  new Set(views.map((entry) => String(entry?.id)).filter(Boolean));

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

  if (!isMobileView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Suggestions</h2>
          <p className="mt-2 text-sm text-gray-500">
            Cette page est disponible sur mobile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        <section className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Suggestions</h1>
            <p className="text-xs text-gray-500">
              Basé sur vos produits consultés récemment
            </p>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!preferredCategories.length && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Consultez quelques produits pour obtenir des suggestions personnalisées.
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-48"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {items.map((product) => (
              <Link
                key={product._id}
                to={buildProductPath(product)}
                {...externalLinkProps}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {product.title}
                </p>
                <p className="mt-2 text-sm font-bold text-indigo-600">
                  {Number(product.price).toLocaleString()} FCFA
                </p>
              </Link>
            ))}
          </div>
        )}

        {loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32"></div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && preferredCategories.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Aucune suggestion disponible pour le moment.
          </div>
        )}
      </main>
    </div>
  );
}
