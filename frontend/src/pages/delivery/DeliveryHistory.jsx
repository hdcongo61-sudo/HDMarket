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
  { key: 'today', label: 'Aujourd’hui' },
  { key: 'all', label: 'Toutes' }
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
    <div className="mx-auto w-full max-w-4xl space-y-4 bg-[#f5f5f5] px-3 pb-20 pt-2 dark:bg-neutral-950 sm:px-5">
      <OfflineBanner offline={isOffline} />

      <DeliveryHeader
        title="Historique"
        subtitle="Livraisons terminees et incidents"
        online={!isOffline}
        actions={[
          { key: 'back', label: 'Missions', to: `${routePrefix}/dashboard`, icon: ArrowLeft },
          { key: 'profile', label: 'Profil', to: buildProfileRoute(routePrefix) }
        ]}
      />

      <div className="grid grid-cols-3 gap-2">
        <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-[11px] font-black uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-300">Terminées</p>
          <p className="mt-1 text-lg font-black text-emerald-800 dark:text-emerald-200">{completedCount}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-[11px] font-black uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400">Échecs</p>
          <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{failedCount}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-3 text-center dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-[11px] font-black uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400">Revenus</p>
          <p className="mt-1 text-sm font-black text-[#FF6A00]">{formatCurrency(earnings)}</p>
        </article>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950" style={{ width: 'fit-content' }}>
        <div className="flex gap-1">
          {DATE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setDateFilter(filter.key)}
              className={`min-h-[40px] whitespace-nowrap rounded-lg px-4 text-sm font-black transition ${
                dateFilter === filter.key
                  ? 'bg-[#FF6A00] text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {historyQuery.isLoading ? (
        <DeliverySkeleton count={4} />
      ) : historyQuery.isError ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            {extractMessage(historyQuery.error, 'Impossible de charger l’historique.')}
          </p>
          <button
            type="button"
            onClick={() => historyQuery.refetch()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-[#FF6A00] px-3 text-sm font-black text-white"
          >
            Reessayer
          </button>
        </div>
      ) : doneItems.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm font-black text-gray-900 dark:text-white">Aucune livraison archivee.</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Les livraisons terminees apparaitront ici.</p>
          {historyQuery.hasNextPage ? (
            <button
              type="button"
              onClick={() => historyQuery.fetchNextPage()}
              disabled={historyQuery.isFetchingNextPage}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-black text-gray-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
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
              <div
                key={item._id}
                className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Commande #{String(item.orderId || '').slice(-6)}</p>
                    <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">
                      {item?.pickup?.communeName || 'Pickup'} → {item?.dropoff?.communeName || item?.buyer?.commune || 'Dropoff'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(item.updatedAt || item.createdAt)}</p>
                  </div>
                  <span className={`inline-flex rounded px-2.5 py-1 text-xs font-semibold ${statusPillClassOf(item)}`}>
                    {workflowLabelOf(item)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-50 px-2.5 py-1 font-black text-gray-700 dark:bg-neutral-900 dark:text-gray-200">
                    {formatCurrency(item.deliveryPrice, item.currency)}
                  </span>
                  {dropoffMap ? (
                    <a
                      href={dropoffMap}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 font-black text-gray-700 dark:bg-neutral-900 dark:text-gray-200"
                    >
                      Maps <ExternalLink size={11} />
                    </a>
                  ) : null}
                  <Link
                    to={buildAssignmentRoute({ basePath: routePrefix, id: item._id })}
                    className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 font-black text-[#FF6A00] dark:bg-orange-950 dark:text-orange-300"
                  >
                    Detail
                  </Link>
                </div>
              </div>
            );
          })}

          <div ref={loadMoreRef} className="h-8" />
          {historyQuery.isFetchingNextPage ? (
            <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Chargement...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
