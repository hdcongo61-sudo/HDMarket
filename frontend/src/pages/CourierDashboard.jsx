import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronRight, History, Loader2, LogOut, RefreshCcw, User } from 'lucide-react';
import api from '../services/api';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../components/modals/BaseModal';
import AuthContext from '../context/AuthContext';
import DeliveryActionFooter from '../components/delivery/DeliveryActionFooter';
import DeliveryHeader from '../components/delivery/DeliveryHeader';
import DeliveryKpiRow from '../components/delivery/DeliveryKpiRow';
import DeliveryListItem from '../components/delivery/DeliveryListItem';
import DeliverySkeleton from '../components/delivery/DeliverySkeleton';
import DeliveryTabs from '../components/delivery/DeliveryTabs';
import NextDeliveryCard from '../components/delivery/NextDeliveryCard';
import OfflineBanner from '../components/delivery/OfflineBanner';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import {
  buildAssignmentRoute,
  buildHistoryRoute,
  buildProfileRoute,
  extractMessage,
  formatCurrency,
  getApiModeFromPath,
  isDoneDelivery,
  isItemInTab,
  sortByPriority,
  workflowStatusOf
} from '../utils/deliveryUi';
import { resolveDeliveryGuyProfileImage } from '../utils/deliveryGuyAvatar';

const FEED_TABS = [
  { key: 'new', label: 'New' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' }
];

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'all', label: 'All' }
];

const PAGE_SIZE = 12;
const REVENUE_PAGE_LIMIT = 50;
const REVENUE_MAX_ITEMS = 200;
const COURIER_VIEW_MODE_KEY = 'hdmarket:courier-view-mode';

const getDayStart = (value = Date.now()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const getWeekStart = (value = Date.now()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - 6);
  return date.getTime();
};

const buildListParams = ({ dateFilter, page = 1, limit = PAGE_SIZE, deliveryGuyId = '' } = {}) => {
  const params = new URLSearchParams();
  params.set('date', dateFilter || 'today');
  params.set('page', String(page || 1));
  params.set('limit', String(limit || PAGE_SIZE));
  if (deliveryGuyId) params.set('deliveryGuyId', String(deliveryGuyId));
  return params.toString();
};

const mergeInfiniteItems = (data = {}) =>
  (Array.isArray(data?.pages) ? data.pages : []).flatMap((page) => (Array.isArray(page?.items) ? page.items : []));

const updateInfiniteDataItems = (prev, updater) => {
  if (!prev || !Array.isArray(prev.pages)) return prev;
  return {
    ...prev,
    pages: prev.pages.map((page) => ({
      ...page,
      items: (Array.isArray(page?.items) ? page.items : []).map((item) => updater(item))
    }))
  };
};

const sumRevenueFromItems = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((total, item) => total + Math.max(0, Number(item?.deliveryPrice || 0)), 0);

export default function CourierDashboard() {
  const { logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { apiPrefix, useLegacyCourierApi, routePrefix } = useMemo(
    () => getApiModeFromPath(location.pathname),
    [location.pathname]
  );

  const [feedTab, setFeedTab] = useState('new');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedDeliveryGuyId, setSelectedDeliveryGuyId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [pullDistance, setPullDistance] = useState(0);
  const [rejectDialog, setRejectDialog] = useState({ open: false, item: null, reason: '' });
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const touchStartYRef = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const bootstrapQuery = useQuery({
    queryKey: ['delivery', 'bootstrap', apiPrefix],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/bootstrap`);
      return data || {};
    },
    staleTime: 30_000,
    retry: 1
  });

  const previewMode = Boolean(bootstrapQuery.data?.previewMode);
  const availableDeliveryGuys = useMemo(
    () =>
      Array.isArray(bootstrapQuery.data?.availableDeliveryGuys)
        ? bootstrapQuery.data.availableDeliveryGuys
        : [],
    [bootstrapQuery.data?.availableDeliveryGuys]
  );

  useEffect(() => {
    if (!previewMode) {
      setSelectedDeliveryGuyId('');
      return;
    }
    if (!availableDeliveryGuys.length) {
      setSelectedDeliveryGuyId('');
      return;
    }
    if (
      selectedDeliveryGuyId &&
      availableDeliveryGuys.some((entry) => String(entry?._id || '') === String(selectedDeliveryGuyId))
    ) {
      return;
    }
    setSelectedDeliveryGuyId(String(availableDeliveryGuys[0]?._id || ''));
  }, [availableDeliveryGuys, previewMode, selectedDeliveryGuyId]);

  const selectedDeliveryGuy = availableDeliveryGuys.find(
    (entry) => String(entry?._id || '') === String(selectedDeliveryGuyId || '')
  );

  const assignmentsQuery = useInfiniteQuery({
    queryKey: ['delivery', 'list', apiPrefix, dateFilter, previewMode, selectedDeliveryGuyId],
    queryFn: async ({ pageParam = 1 }) => {
      const params = buildListParams({
        dateFilter,
        page: pageParam,
        limit: PAGE_SIZE,
        deliveryGuyId: previewMode && selectedDeliveryGuyId ? selectedDeliveryGuyId : ''
      });
      const endpoint = useLegacyCourierApi ? `/assignments?${params}` : `/jobs?${params}`;
      const { data } = await api.get(`${apiPrefix}${endpoint}`);
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        page: Number(data?.page || pageParam || 1),
        totalPages: Math.max(1, Number(data?.totalPages || 1)),
        total: Number(data?.total || 0)
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      Number(lastPage?.page || 1) < Number(lastPage?.totalPages || 1)
        ? Number(lastPage.page) + 1
        : undefined,
    enabled: bootstrapQuery.isSuccess && (!previewMode || Boolean(selectedDeliveryGuyId)),
    staleTime: 15_000,
    retry: 1,
    refetchInterval: isOffline ? false : 15_000
  });

  const allItems = useMemo(() => mergeInfiniteItems(assignmentsQuery.data), [assignmentsQuery.data]);

  const filteredItems = useMemo(
    () => allItems.filter((item) => isItemInTab(item, feedTab)),
    [allItems, feedTab]
  );

  const fetchRevenueItems = async ({ date = 'today' } = {}) => {
    const collected = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && collected.length < REVENUE_MAX_ITEMS) {
      const params = new URLSearchParams();
      params.set('status', 'DELIVERED');
      params.set('date', date);
      params.set('limit', String(REVENUE_PAGE_LIMIT));
      params.set('page', String(page));
      if (previewMode && selectedDeliveryGuyId) params.set('deliveryGuyId', selectedDeliveryGuyId);

      const endpoint = useLegacyCourierApi ? `/assignments?${params.toString()}` : `/jobs?${params.toString()}`;
      const { data } = await api.get(`${apiPrefix}${endpoint}`);
      const chunk = Array.isArray(data?.items) ? data.items : [];
      collected.push(...chunk);
      totalPages = Math.max(1, Number(data?.totalPages || 1));
      page += 1;
    }

    return collected.slice(0, REVENUE_MAX_ITEMS);
  };

  const todayRevenueQuery = useQuery({
    queryKey: ['delivery', 'revenue', 'today', apiPrefix, previewMode, selectedDeliveryGuyId],
    queryFn: () => fetchRevenueItems({ date: 'today' }),
    enabled: bootstrapQuery.isSuccess && (!previewMode || Boolean(selectedDeliveryGuyId)),
    staleTime: 60_000,
    retry: 1
  });

  const weekRevenueQuery = useQuery({
    queryKey: ['delivery', 'revenue', 'week', apiPrefix, previewMode, selectedDeliveryGuyId],
    queryFn: () => fetchRevenueItems({ date: 'all' }),
    enabled: bootstrapQuery.isSuccess && (!previewMode || Boolean(selectedDeliveryGuyId)),
    staleTime: 60_000,
    retry: 1
  });

  const statsQuery = useQuery({
    queryKey: ['delivery', 'stats', apiPrefix, previewMode, selectedDeliveryGuyId],
    queryFn: async () => {
      const { data } = await api.get(`${apiPrefix}/stats`);
      return data?.stats || null;
    },
    enabled: bootstrapQuery.isSuccess && !previewMode,
    staleTime: 30_000,
    retry: 1
  });

  const counts = useMemo(() => {
    const base = { new: 0, active: 0, done: 0 };
    return allItems.reduce((acc, item) => {
      if (isItemInTab(item, 'new')) acc.new += 1;
      if (isItemInTab(item, 'active')) acc.active += 1;
      if (isItemInTab(item, 'done')) acc.done += 1;
      return acc;
    }, base);
  }, [allItems]);

  const todayRevenue = useMemo(
    () => sumRevenueFromItems(todayRevenueQuery.data || []),
    [todayRevenueQuery.data]
  );

  const weekRevenue = useMemo(() => {
    const weekStart = getWeekStart(Date.now());
    const items = Array.isArray(weekRevenueQuery.data) ? weekRevenueQuery.data : [];
    return items.reduce((sum, item) => {
      const at = new Date(item?.deliveryProof?.submittedAt || item?.updatedAt || item?.createdAt || 0).getTime();
      if (!Number.isFinite(at) || at < weekStart) return sum;
      return sum + Math.max(0, Number(item?.deliveryPrice || 0));
    }, 0);
  }, [weekRevenueQuery.data]);

  const sortedAllItems = useMemo(() => sortByPriority(allItems), [allItems]);
  const nextDelivery = useMemo(
    () => sortedAllItems.find((item) => !isDoneDelivery(item)) || sortedAllItems[0] || null,
    [sortedAllItems]
  );

  const selectedPreviewItem =
    allItems.find((item) => String(item?._id || '') === String(selectedAssignmentId || '')) || nextDelivery;

  const updateDeliveryListCache = (updater) => {
    queryClient.setQueriesData({ queryKey: ['delivery', 'list'] }, (previous) =>
      updateInfiniteDataItems(previous, updater)
    );
  };

  const acceptMutation = useMutation({
    mutationFn: async ({ id }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/accept` : `/jobs/${id}/accept`;
      const payload = previewMode && selectedDeliveryGuyId ? { deliveryGuyId: selectedDeliveryGuyId } : {};
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, payload);
      return data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['delivery', 'list'] });
      const previous = queryClient.getQueriesData({ queryKey: ['delivery', 'list'] });
      updateDeliveryListCache((item) =>
        String(item?._id || '') === String(id)
          ? {
              ...item,
              assignmentStatus: 'ACCEPTED',
              status: item?.status === 'PENDING' ? 'ACCEPTED' : item?.status,
              currentStage: item?.currentStage === 'ASSIGNED' ? 'ACCEPTED' : item?.currentStage,
              updatedAt: new Date().toISOString()
            }
          : item
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      (context?.previous || []).forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => {
      const endpoint = useLegacyCourierApi ? `/assignments/${id}/reject` : `/jobs/${id}/reject`;
      const payload = {
        reason,
        ...(previewMode && selectedDeliveryGuyId ? { deliveryGuyId: selectedDeliveryGuyId } : {})
      };
      const { data } = await api.patch(`${apiPrefix}${endpoint}`, payload);
      return data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['delivery', 'list'] });
      const previous = queryClient.getQueriesData({ queryKey: ['delivery', 'list'] });
      updateDeliveryListCache((item) =>
        String(item?._id || '') === String(id)
          ? {
              ...item,
              assignmentStatus: 'REJECTED',
              status: 'REJECTED',
              updatedAt: new Date().toISOString()
            }
          : item
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      (context?.previous || []).forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery'] });
    }
  });

  const openDetail = (item) => {
    if (!item?._id) return;
    setSelectedAssignmentId(String(item._id));
    navigate(buildAssignmentRoute({ basePath: routePrefix, id: item._id }));
  };

  const openRejectDialog = (item) => {
    if (!item?._id) return;
    setRejectDialog({ open: true, item, reason: '' });
  };

  const handleSubmitReject = () => {
    const reason = String(rejectDialog.reason || '').trim();
    if (!rejectDialog.item?._id || !reason || rejectMutation.isPending || isOffline) return;
    rejectMutation.mutate(
      { id: rejectDialog.item._id, reason },
      {
        onSuccess: () => {
          setRejectDialog({ open: false, item: null, reason: '' });
        }
      }
    );
  };

  const handleRefresh = () => {
    assignmentsQuery.refetch();
    todayRevenueQuery.refetch();
    weekRevenueQuery.refetch();
    statsQuery.refetch();
  };

  const handleLogout = async () => {
    try {
      await api.post(`${apiPrefix}/logout-event`, {});
    } catch {
      // best effort event log
    }
    queryClient.clear();
    await logout();
  };

  const handleSwitchToNormalAccount = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COURIER_VIEW_MODE_KEY, 'normal');
    }
    navigate('/');
  };

  const nextCardActions = useMemo(() => {
    if (!nextDelivery?._id) return { primaryLabel: 'Aucune action', onPrimary: undefined };
    const workflow = workflowStatusOf(nextDelivery);
    if (workflow === 'NEW') {
      return {
        primaryLabel: 'Accepter',
        onPrimary: () => acceptMutation.mutate({ id: nextDelivery._id }),
        primaryDisabled: acceptMutation.isPending || isOffline,
        secondaryLabel: 'Refuser',
        onSecondary: () => openRejectDialog(nextDelivery),
        secondaryDisabled: rejectMutation.isPending || isOffline
      };
    }
    if (workflow === 'ACCEPTED') {
      return {
        primaryLabel: 'Confirmer pickup',
        onPrimary: () => openDetail(nextDelivery),
        secondaryLabel: 'Détails',
        onSecondary: () => openDetail(nextDelivery)
      };
    }
    if (workflow === 'PICKUP') {
      return {
        primaryLabel: 'Démarrer route',
        onPrimary: () => openDetail(nextDelivery),
        secondaryLabel: 'Détails',
        onSecondary: () => openDetail(nextDelivery)
      };
    }
    if (workflow === 'ON_ROUTE') {
      return {
        primaryLabel: 'Confirmer livré',
        onPrimary: () => openDetail(nextDelivery),
        secondaryLabel: 'Détails',
        onSecondary: () => openDetail(nextDelivery)
      };
    }
    return {
      primaryLabel: 'Voir résumé',
      onPrimary: () => openDetail(nextDelivery),
      secondaryLabel: '',
      onSecondary: undefined
    };
  }, [acceptMutation.isPending, isOffline, nextDelivery, rejectMutation.isPending]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      }),
    []
  );

  const headerActions = [
    ...(!previewMode
      ? [
          {
            key: 'normal-account',
            label: 'Compte normal',
            onClick: handleSwitchToNormalAccount,
            icon: ArrowLeftRight
          }
        ]
      : []),
    {
      key: 'history',
      label: 'History',
      to: buildHistoryRoute(routePrefix),
      icon: History
    },
    {
      key: 'profile',
      label: 'Profile',
      to: buildProfileRoute(routePrefix),
      icon: User
    },
    {
      key: 'refresh',
      label: 'Refresh',
      onClick: handleRefresh,
      icon: RefreshCcw,
      disabled: assignmentsQuery.isFetching
    },
    {
      key: 'logout',
      label: 'Logout',
      onClick: handleLogout,
      icon: LogOut,
      tone: 'danger'
    }
  ];

  useEffect(() => {
    if (!assignmentsQuery.hasNextPage || assignmentsQuery.isFetchingNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          assignmentsQuery.fetchNextPage();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [assignmentsQuery]);

  const handleTouchStart = (event) => {
    if (typeof window === 'undefined' || window.scrollY > 0) {
      touchStartYRef.current = null;
      return;
    }
    touchStartYRef.current = event.touches?.[0]?.clientY || null;
  };

  const handleTouchMove = (event) => {
    const startY = touchStartYRef.current;
    if (startY == null) return;
    const currentY = event.touches?.[0]?.clientY || startY;
    const delta = Math.max(0, Math.min(90, currentY - startY));
    setPullDistance(delta);
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 70) {
      handleRefresh();
    }
    setPullDistance(0);
    touchStartYRef.current = null;
  };

  const hardError = bootstrapQuery.error || assignmentsQuery.error;
  const modeEnabled = bootstrapQuery.data?.enabled !== false;
  const timeoutDetected = /timeout|ECONNABORTED/i.test(
    `${extractMessage(hardError, '')} ${String(hardError?.code || '')}`
  );

  const kpiItems = [
    {
      key: 'todo',
      label: 'A faire',
      value: counts.new,
      toneClass: 'bg-yellow-100 text-yellow-700'
    },
    {
      key: 'active',
      label: 'En cours',
      value: counts.active,
      toneClass: 'bg-blue-100 text-blue-700'
    },
    {
      key: 'done',
      label: 'Terminees',
      value: counts.done,
      toneClass: 'bg-green-100 text-green-700'
    },
    {
      key: 'today-revenue',
      label: 'Revenus auj.',
      value: `${todayRevenue.toLocaleString('fr-FR')} XAF`,
      toneClass: 'bg-indigo-100 text-indigo-700'
    },
    {
      key: 'week-revenue',
      label: 'Revenus semaine',
      value: `${weekRevenue.toLocaleString('fr-FR')} XAF`,
      toneClass: 'bg-indigo-100 text-indigo-700'
    }
  ];

  return (
    <div
      className="glass-page-shell mx-auto w-full max-w-7xl space-y-4 px-3 pb-28 pt-2 sm:px-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+64px)] z-50 mx-auto w-full max-w-sm px-3 sm:hidden"
        style={{ opacity: pullDistance ? 1 : 0, transform: `translateY(${Math.max(0, pullDistance / 3)}px)` }}
      >
        <div className="glass-card rounded-full px-3 py-1 text-center text-xs font-semibold text-slate-900 dark:text-white">
          {pullDistance >= 70 ? 'Relacher pour rafraichir' : 'Tirer pour rafraichir'}
        </div>
      </div>

      <OfflineBanner offline={isOffline} />

      <DeliveryHeader
        title="Livraisons"
        subtitle={todayLabel}
        online={!isOffline}
        actions={headerActions}
      />

      <DeliveryKpiRow
        items={kpiItems}
        loading={bootstrapQuery.isLoading || todayRevenueQuery.isLoading || weekRevenueQuery.isLoading}
      />

      {previewMode ? (
        <section className="soft-card soft-card-purple rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-purple-700 dark:text-purple-100">Mode preview admin</p>
          <p className="mt-1 text-xs text-purple-700/90 dark:text-purple-100/90">Selectionnez un livreur pour simuler son dashboard.</p>
          <label className="mt-3 block text-sm font-medium text-indigo-800">
            Livreur
            <select
              value={selectedDeliveryGuyId}
              onChange={(event) => setSelectedDeliveryGuyId(event.target.value)}
              className="ui-input mt-1 min-h-[44px] w-full rounded-xl bg-white/70 px-3 text-sm text-slate-800 dark:text-slate-100"
            >
              <option value="">Choisir un livreur</option>
              {availableDeliveryGuys.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.fullName || 'Livreur'}{entry.phone ? ` · ${entry.phone}` : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedDeliveryGuy ? (
            <div className="glass-card mt-3 flex items-center gap-3 rounded-xl p-3">
              {resolveDeliveryGuyProfileImage(selectedDeliveryGuy) ? (
                <img
                  src={resolveDeliveryGuyProfileImage(selectedDeliveryGuy)}
                  alt={selectedDeliveryGuy.fullName || 'Livreur'}
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="soft-card soft-card-purple flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-purple-700 dark:text-purple-100">
                  {String(selectedDeliveryGuy.fullName || selectedDeliveryGuy.name || 'L').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedDeliveryGuy.fullName || selectedDeliveryGuy.name || 'Livreur'}
                </p>
                <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                  {selectedDeliveryGuy.phone || 'Telephone non renseigne'}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {nextDelivery ? (
        <div className="lg:hidden">
          <NextDeliveryCard
            assignment={nextDelivery}
            title="Next delivery"
            primaryLabel={nextCardActions.primaryLabel}
            secondaryLabel={nextCardActions.secondaryLabel}
            onPrimary={nextCardActions.onPrimary}
            onSecondary={nextCardActions.onSecondary}
            primaryDisabled={nextCardActions.primaryDisabled}
            secondaryDisabled={nextCardActions.secondaryDisabled}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-3">
          <div className="glass-card rounded-2xl p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Date filter</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DATE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setDateFilter(filter.key)}
                  className={`min-h-[40px] whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98] ${
                    dateFilter === filter.key
                      ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                      : 'glass-card text-slate-600 dark:text-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <DeliveryTabs value={feedTab} onChange={setFeedTab} tabs={FEED_TABS} />

          {bootstrapQuery.isLoading || assignmentsQuery.isLoading ? (
            <DeliverySkeleton count={4} />
          ) : hardError ? (
            <NetworkFallbackCard
              title={extractMessage(hardError, 'Unable to load data.')}
              message={
                timeoutDetected
                  ? 'Network is slow, please retry.'
                  : 'Unable to load deliveries right now.'
              }
              onRetry={handleRefresh}
              retryLabel="Retry"
              refreshLabel="Refresh page"
            />
          ) : !modeEnabled ? (
            <div className="soft-card soft-card-orange rounded-2xl p-4 text-sm text-amber-800 shadow-sm dark:text-amber-100">
              Le mode livreur est desactive par la configuration systeme.
            </div>
          ) : previewMode && !selectedDeliveryGuyId ? (
            <div className="soft-card soft-card-purple rounded-2xl p-4 text-sm text-purple-800 shadow-sm dark:text-purple-100">
              Choisissez un livreur pour afficher ses livraisons.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {feedTab === 'done' ? 'All caught up' : 'No deliveries yet'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                {feedTab === 'done'
                  ? 'Aucune livraison terminee pour ce filtre.'
                  : 'Les nouvelles affectations apparaitront ici.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <DeliveryListItem
                  key={item._id}
                  item={item}
                  onOpen={openDetail}
                  onAccept={() => acceptMutation.mutate({ id: item._id })}
                  onReject={() => openRejectDialog(item)}
                  acceptDisabled={acceptMutation.isPending}
                  rejectDisabled={rejectMutation.isPending}
                  actionsDisabled={isOffline}
                />
              ))}

              <div ref={loadMoreRef} className="h-8" />

              {assignmentsQuery.isFetchingNextPage ? (
                <div className="glass-card inline-flex w-full items-center justify-center gap-2 rounded-xl p-3 text-xs text-slate-500 shadow-sm dark:text-slate-300">
                  <Loader2 size={14} className="animate-spin" />
                  Chargement...
                </div>
              ) : null}

              {!assignmentsQuery.hasNextPage && filteredItems.length > 0 ? (
                <p className="text-center text-xs text-slate-500 dark:text-slate-300">Fin de la liste</p>
              ) : null}
            </div>
          )}
        </section>

        <aside className="hidden space-y-4 lg:block">
          <div className="sticky top-[120px] space-y-4">
            <NextDeliveryCard
              assignment={selectedPreviewItem}
              title="Next delivery"
              primaryLabel={nextCardActions.primaryLabel}
              secondaryLabel={nextCardActions.secondaryLabel}
              onPrimary={nextCardActions.onPrimary}
              onSecondary={nextCardActions.onSecondary}
              primaryDisabled={nextCardActions.primaryDisabled}
              secondaryDisabled={nextCardActions.secondaryDisabled}
            />

            <section className="glass-card rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Mini stats</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-100">
                <p className="flex items-center justify-between"><span>Completed</span><strong>{statsQuery.data?.delivered ?? '—'}</strong></p>
                <p className="flex items-center justify-between"><span>Failed</span><strong>{statsQuery.data?.failed ?? '—'}</strong></p>
                <p className="flex items-center justify-between"><span>Acceptance rate</span><strong>{statsQuery.data ? `${statsQuery.data.acceptanceRate || 0}%` : '—'}</strong></p>
                <p className="flex items-center justify-between"><span>Avg delivery time</span><strong>{statsQuery.data?.avgPickupToDeliveredMinutes ? `${statsQuery.data.avgPickupToDeliveredMinutes} min` : '—'}</strong></p>
                <p className="flex items-center justify-between"><span>Total earnings</span><strong>{statsQuery.data ? formatCurrency(statsQuery.data.deliveryFeeRevenue || 0) : '—'}</strong></p>
              </div>
              {selectedPreviewItem?._id ? (
                <Link
                  to={buildAssignmentRoute({ basePath: routePrefix, id: selectedPreviewItem._id })}
                  className="soft-card soft-card-purple mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-purple-900 dark:text-purple-100"
                >
                  Open selected
                  <ChevronRight size={14} />
                </Link>
              ) : null}
            </section>
          </div>
        </aside>
      </div>

      {nextDelivery && !isDoneDelivery(nextDelivery) ? (
        <div className="lg:hidden">
          <DeliveryActionFooter
            primaryLabel={nextCardActions.primaryLabel}
            onPrimary={nextCardActions.onPrimary}
            primaryDisabled={nextCardActions.primaryDisabled}
            primaryLoading={acceptMutation.isPending || rejectMutation.isPending}
            secondaryLabel={nextCardActions.secondaryLabel || 'Detailler'}
            onSecondary={nextCardActions.onSecondary || (() => openDetail(nextDelivery))}
            secondaryDisabled={nextCardActions.secondaryDisabled}
          />
        </div>
      ) : null}

      <BaseModal
        isOpen={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, item: null, reason: '' })}
        panelClassName="w-full max-w-md"
      >
        <ModalHeader
          title="Refuser cette livraison"
          subtitle={rejectDialog.item ? `Commande #${String(rejectDialog.item.orderId || '').slice(-6)}` : ''}
          onClose={() => setRejectDialog({ open: false, item: null, reason: '' })}
        />
        <ModalBody className="space-y-3">
          <textarea
            value={rejectDialog.reason}
            onChange={(event) =>
              setRejectDialog((prev) => ({
                ...prev,
                reason: event.target.value.slice(0, 600)
              }))
            }
            rows={4}
            placeholder="Expliquez la raison du refus"
            className="ui-input w-full rounded-xl px-3 py-2 text-sm"
          />
          {rejectMutation.isError ? (
            <p className="text-xs text-red-600">{extractMessage(rejectMutation.error, 'Impossible de refuser.')}</p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRejectDialog({ open: false, item: null, reason: '' })}
              className="glass-card inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-700 dark:text-slate-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmitReject}
              disabled={!rejectDialog.reason.trim() || rejectMutation.isPending || isOffline}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {rejectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirmer
            </button>
          </div>
        </ModalFooter>
      </BaseModal>
    </div>
  );
}
