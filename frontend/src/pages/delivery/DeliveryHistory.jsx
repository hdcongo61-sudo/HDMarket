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

const REQUEST_TIMEOUT_MS = 8000;

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
      const { data } = await api.get(`${apiPrefix}${endpoint}`, { timeout: REQUEST_TIMEOUT_MS });
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
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 pb-20 pt-2 sm:px-5">
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

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <article className="rounded-xl bg-green-50 p-3 text-center">
            <p className="text-xs text-green-700">Completed</p>
            <p className="mt-1 text-lg font-semibold text-green-800">{completedCount}</p>
          </article>
          <article className="rounded-xl bg-gray-100 p-3 text-center">
            <p className="text-xs text-gray-600">Failed</p>
            <p className="mt-1 text-lg font-semibold text-gray-800">{failedCount}</p>
          </article>
          <article className="rounded-xl bg-indigo-50 p-3 text-center">
            <p className="text-xs text-indigo-700">Earnings</p>
            <p className="mt-1 text-sm font-semibold text-indigo-800">{formatCurrency(earnings)}</p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Date</p>
        <div className="flex gap-2">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`min-h-[40px] rounded-xl px-3 text-sm font-semibold ${
                dateFilter === filter.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
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
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-red-700">
            {extractMessage(historyQuery.error, 'Impossible de charger l’historique.')}
          </p>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white"
          >
            Reessayer
          </button>
        </div>
      ) : doneItems.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-800">Aucune livraison archivee.</p>
          <p className="mt-1 text-xs text-gray-500">Les livraisons terminees apparaitront ici.</p>
          {historyQuery.hasNextPage ? (
            <button
              type="button"
              onClick={() => historyQuery.fetchNextPage()}
              disabled={historyQuery.isFetchingNextPage}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
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
              <article key={item._id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Commande #{String(item.orderId || '').slice(-6)}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {item?.pickup?.communeName || 'Pickup'} → {item?.dropoff?.communeName || item?.buyer?.commune || 'Dropoff'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{fmtDateTime(item.updatedAt || item.createdAt)}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(item)}`}>
                    {workflowLabelOf(item)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700">
                    {formatCurrency(item.deliveryPrice, item.currency)}
                  </span>
                  {dropoffMap ? (
                    <a
                      href={dropoffMap}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700"
                    >
                      Maps <ExternalLink size={11} />
                    </a>
                  ) : null}
                  <Link
                    to={buildAssignmentRoute({ basePath: routePrefix, id: item._id })}
                    className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-1 font-semibold text-white"
                  >
                    Detail
                  </Link>
                </div>
              </article>
            );
          })}

          <div ref={loadMoreRef} className="h-8" />
          {historyQuery.isFetchingNextPage ? (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white p-3 text-xs text-gray-500 shadow-sm">
              <Loader2 size={14} className="animate-spin" /> Chargement...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
