import React, { useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import api from '../../services/api';
import DeliveryHeader from '../../components/delivery/DeliveryHeader';
import DeliverySkeleton from '../../components/delivery/DeliverySkeleton';
import OfflineBanner from '../../components/delivery/OfflineBanner';
import {
  buildAssignmentRoute,
  buildGoogleMapHref,
  buildProfileRoute,
  extractMessage,
  fmtDateTime,
  formatCurrency,
  getApiModeFromPath,
  isDoneDelivery,
  statusPillClassOf,
  workflowLabelOf
} from '../../utils/deliveryUi';

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'all', label: 'All' }
];

const PAGE_SIZE = 16;

export default function DeliveryHistory() {
  const location = useLocation();
  const { apiPrefix, useLegacyCourierApi, routePrefix } = useMemo(
    () => getApiModeFromPath(location.pathname),
    [location.pathname]
  );

  const [dateFilter, setDateFilter] = useState('all');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const loadMoreRef = useRef(null);

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const historyQuery = useInfiniteQuery({
    queryKey: ['delivery', 'history', apiPrefix, dateFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set('date', dateFilter);
      params.set('page', String(pageParam));
      params.set('limit', String(PAGE_SIZE));
      const endpoint = useLegacyCourierApi ? `/assignments?${params.toString()}` : `/jobs?${params.toString()}`;
      const { data } = await api.get(`${apiPrefix}${endpoint}`);
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        page: Number(data?.page || pageParam || 1),
        totalPages: Math.max(1, Number(data?.totalPages || 1))
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      Number(lastPage?.page || 1) < Number(lastPage?.totalPages || 1)
        ? Number(lastPage.page) + 1
        : undefined,
    staleTime: 30_000,
    retry: 1,
    refetchInterval: isOffline ? false : 20_000
  });

  const allItems = useMemo(
    () => (Array.isArray(historyQuery.data?.pages) ? historyQuery.data.pages : []).flatMap((page) => page.items || []),
    [historyQuery.data]
  );

  const doneItems = useMemo(() => allItems.filter((item) => isDoneDelivery(item)), [allItems]);

  const completedCount = useMemo(
    () => doneItems.filter((item) => String(item?.status || '').toUpperCase() === 'DELIVERED').length,
    [doneItems]
  );

  const failedCount = useMemo(
    () => doneItems.filter((item) => String(item?.status || '').toUpperCase() === 'FAILED').length,
    [doneItems]
  );

  const earnings = useMemo(
    () =>
      doneItems.reduce((sum, item) => {
        if (String(item?.status || '').toUpperCase() !== 'DELIVERED') return sum;
        return sum + Math.max(0, Number(item?.deliveryPrice || 0));
      }, 0),
    [doneItems]
  );

  React.useEffect(() => {
    if (!historyQuery.hasNextPage || historyQuery.isFetchingNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          historyQuery.fetchNextPage();
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [historyQuery]);

  return (
    <div className="glass-page-shell mx-auto w-full max-w-4xl space-y-4 px-3 pb-20 pt-2 sm:px-5">
      <OfflineBanner offline={isOffline} />

      <DeliveryHeader
        title="Historique"
        subtitle="Livraisons terminees et incidents"
        online={!isOffline}
        actions={[
          { key: 'back', label: 'Dashboard', to: `${routePrefix}/dashboard`, icon: ArrowLeft },
          { key: 'profile', label: 'Profile', to: buildProfileRoute(routePrefix) }
        ]}
      />

      <section className="glass-card rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <article className="soft-card soft-card-green rounded-xl p-3 text-center">
            <p className="text-xs text-green-700 dark:text-green-100">Completed</p>
            <p className="mt-1 text-lg font-semibold text-green-800 dark:text-green-100">{completedCount}</p>
          </article>
          <article className="glass-card rounded-xl p-3 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-300">Failed</p>
            <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-white">{failedCount}</p>
          </article>
          <article className="soft-card soft-card-purple rounded-xl p-3 text-center">
            <p className="text-xs text-purple-700 dark:text-purple-100">Earnings</p>
            <p className="mt-1 text-sm font-semibold text-purple-800 dark:text-purple-100">{formatCurrency(earnings)}</p>
          </article>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Date</p>
        <div className="flex gap-2">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`min-h-[40px] rounded-xl px-3 text-sm font-semibold ${
                dateFilter === filter.key
                  ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                  : 'glass-card text-slate-700 dark:text-slate-100'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {historyQuery.isLoading ? (
        <DeliverySkeleton count={4} />
      ) : historyQuery.isError ? (
        <div className="glass-card rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700 dark:text-red-100">
            {extractMessage(historyQuery.error, 'Impossible de charger l’historique.')}
          </p>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="glass-card mt-3 inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-slate-900 dark:text-white"
          >
            Reessayer
          </button>
        </div>
      ) : doneItems.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Aucune livraison archivee.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Les livraisons terminees apparaitront ici.</p>
          {historyQuery.hasNextPage ? (
            <button
              type="button"
              onClick={() => historyQuery.fetchNextPage()}
              disabled={historyQuery.isFetchingNextPage}
              className="glass-card mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-900 disabled:opacity-60 dark:text-white"
            >
              {historyQuery.isFetchingNextPage ? <Loader2 size={14} className="animate-spin" /> : null}
              Charger plus
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {doneItems.map((item) => {
            const dropoffAddress = item?.dropoff?.address || item?.buyer?.address || '';
            const dropoffMap = buildGoogleMapHref(
              item?.dropoff?.coordinates,
              `${dropoffAddress} ${item?.dropoff?.communeName || item?.buyer?.commune || ''}`
            );
            return (
              <article key={item._id} className="glass-card rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Commande #{String(item.orderId || '').slice(-6)}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {item?.pickup?.communeName || 'Pickup'} → {item?.dropoff?.communeName || item?.buyer?.commune || 'Dropoff'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{fmtDateTime(item.updatedAt || item.createdAt)}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(item)}`}>
                    {workflowLabelOf(item)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="glass-card rounded-full px-2 py-1 font-semibold text-slate-700 dark:text-slate-100">
                    {formatCurrency(item.deliveryPrice, item.currency)}
                  </span>
                  {dropoffMap ? (
                    <a
                      href={dropoffMap}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-card inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-slate-700 dark:text-slate-100"
                    >
                      Maps <ExternalLink size={11} />
                    </a>
                  ) : null}
                  <Link
                    to={buildAssignmentRoute({ basePath: routePrefix, id: item._id })}
                    className="soft-card soft-card-purple inline-flex items-center rounded-full px-2.5 py-1 font-semibold text-purple-900 dark:text-purple-100"
                  >
                    Detail
                  </Link>
                </div>
              </article>
            );
          })}

          <div ref={loadMoreRef} className="h-8" />
          {historyQuery.isFetchingNextPage ? (
            <div className="glass-card inline-flex w-full items-center justify-center gap-2 rounded-xl p-3 text-xs text-slate-500 shadow-sm dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" /> Chargement...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
