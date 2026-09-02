import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveBoxArrowDownIcon, ArchiveBoxIcon, ArrowTurnUpLeftIcon, ChatBubbleLeftIcon, CubeIcon, LockClosedIcon, MagnifyingGlassIcon, TruckIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import storage from '../utils/storage';
import AuthContext from '../context/AuthContext';
import OrderChat from '../components/OrderChat';
import BaseModal, { ModalBody } from '../components/modals/BaseModal';
import {
  fetchOrderConversations,
  fetchOrderUnreadCount,
  startConversation as startConversationRequest
} from '../queries/orderChatApi';
import { orderChatKeys } from '../queries/orderChatKeys';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import useNetworkProfile from '../hooks/useNetworkProfile';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';

const ACTION_NOTES = {
  delivering: { icon: TruckIcon, label: 'En livraison' },
  inquiry: { icon: ArrowTurnUpLeftIcon, label: 'En attente de votre réponse' },
  cancelled: { icon: XCircleIcon, label: 'Commande annulée' }
};

const PAGE_SIZE = 12;

export default function OrderMessages() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [offlineSnapshot, setOfflineSnapshot] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, unread, archived
  const socketRef = useRef(null);
  const handledQueryOrderRef = useRef('');
  const queryClient = useQueryClient();
  const userScopeId = user?._id || user?.id;
  const { rapid3GActive, shouldUseOfflineSnapshot, offlineBannerText, rapid3GBannerText } =
    useNetworkProfile();
  const snapshotKey = useMemo(
    () => ['order-messages', userScopeId || 'guest', activeFilter, page].join(':'),
    [activeFilter, page, userScopeId]
  );
  const requestedConversationId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get('conversationId') || params.get('orderId');
    return String(value || '').trim();
  }, [location.search]);

  const conversationsQuery = useQuery({
    queryKey: orderChatKeys.conversations(userScopeId, {
      page,
      limit: PAGE_SIZE,
      archived: activeFilter === 'archived'
    }),
    enabled: Boolean(userScopeId),
    queryFn: () =>
      fetchOrderConversations({
        page,
        limit: PAGE_SIZE,
        archived: activeFilter === 'archived'
      }),
    staleTime: 20 * 1000,
    placeholderData: (previousData) => previousData
  });

  const unreadQuery = useQuery({
    queryKey: orderChatKeys.unread(userScopeId),
    enabled: Boolean(userScopeId),
    queryFn: fetchOrderUnreadCount,
    staleTime: 10 * 1000
  });

  const conversations = useMemo(
    () => (Array.isArray(conversationsQuery.data?.items) ? conversationsQuery.data.items : []),
    [conversationsQuery.data?.items]
  );
  const meta = useMemo(
    () => ({
      total: Number(conversationsQuery.data?.total || 0),
      totalPages: Number(conversationsQuery.data?.totalPages || 1)
    }),
    [conversationsQuery.data?.total, conversationsQuery.data?.totalPages]
  );
  const totalUnread = Number(unreadQuery.data?.unreadCount || 0);
  const effectiveConversations = offlineSnapshotActive
    ? Array.isArray(offlineSnapshot?.items)
      ? offlineSnapshot.items
      : []
    : conversations;
  const effectiveMeta = offlineSnapshotActive
    ? {
        total: Number(offlineSnapshot?.total || 0),
        totalPages: Number(offlineSnapshot?.totalPages || 1)
      }
    : meta;
  const effectiveTotalUnread = offlineSnapshotActive
    ? Number(offlineSnapshot?.totalUnread || 0)
    : totalUnread;
  const loading = conversationsQuery.isLoading;

  useEffect(() => {
    if (conversationsQuery.error) {
      setError(
        conversationsQuery.error?.response?.data?.message ||
          conversationsQuery.error?.message ||
          'Impossible de charger les conversations.'
      );
    }
  }, [conversationsQuery.error]);

  useEffect(() => {
    if (!conversationsQuery.error || !shouldUseOfflineSnapshot) return;
    let cancelled = false;
    loadOfflineSnapshot(snapshotKey).then((snapshot) => {
      if (cancelled) return;
      if (snapshot && typeof snapshot === 'object') {
        setOfflineSnapshot(snapshot);
        setOfflineSnapshotActive(true);
        setError('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversationsQuery.error, shouldUseOfflineSnapshot, snapshotKey]);

  useEffect(() => {
    if (shouldUseOfflineSnapshot) return;
    if (!Array.isArray(conversations)) return;
    saveOfflineSnapshot(snapshotKey, {
      items: conversations,
      total: Number(meta.total || 0),
      totalPages: Number(meta.totalPages || 1),
      totalUnread: Number(totalUnread || 0)
    });
    setOfflineSnapshotActive(false);
  }, [conversations, meta.total, meta.totalPages, shouldUseOfflineSnapshot, snapshotKey, totalUnread]);

  const archiveConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      await api.post(`/conversations/${String(conversationId)}/archive`);
      return String(conversationId);
    },
    onMutate: async (conversationId) => {
      const targetId = String(conversationId);
      await queryClient.cancelQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      const snapshots = queryClient.getQueriesData({
        queryKey: orderChatKeys.conversationsRoot(userScopeId)
      });
      queryClient.setQueriesData({ queryKey: orderChatKeys.conversationsRoot(userScopeId) }, (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        const nextItems = old.items.filter((item) => String(item.conversationId) !== targetId);
        if (nextItems.length === old.items.length) return old;
        return {
          ...old,
          items: nextItems,
          total: Math.max(0, Number(old.total || 0) - 1)
        };
      });
      return { snapshots };
    },
    onError: (err, _conversationId, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      setError(err.response?.data?.message || "Impossible d'archiver.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      queryClient.invalidateQueries({ queryKey: orderChatKeys.unread(userScopeId) });
    }
  });

  const unarchiveConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      await api.post(`/conversations/${String(conversationId)}/unarchive`);
      return String(conversationId);
    },
    onMutate: async (conversationId) => {
      const targetId = String(conversationId);
      await queryClient.cancelQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      const snapshots = queryClient.getQueriesData({
        queryKey: orderChatKeys.conversationsRoot(userScopeId)
      });
      queryClient.setQueriesData({ queryKey: orderChatKeys.conversationsRoot(userScopeId) }, (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        const nextItems = old.items.filter((item) => String(item.conversationId) !== targetId);
        if (nextItems.length === old.items.length) return old;
        return {
          ...old,
          items: nextItems,
          total: Math.max(0, Number(old.total || 0) - 1)
        };
      });
      return { snapshots };
    },
    onError: (err, _conversationId, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      setError(err.response?.data?.message || "Impossible de désarchiver.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      queryClient.invalidateQueries({ queryKey: orderChatKeys.unread(userScopeId) });
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId) => {
      await api.post(`/conversations/${String(conversationId)}/delete`);
      return String(conversationId);
    },
    onMutate: async (conversationId) => {
      const targetId = String(conversationId);
      await queryClient.cancelQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      const snapshots = queryClient.getQueriesData({
        queryKey: orderChatKeys.conversationsRoot(userScopeId)
      });
      queryClient.setQueriesData({ queryKey: orderChatKeys.conversationsRoot(userScopeId) }, (old) => {
        if (!old || !Array.isArray(old.items)) return old;
        const nextItems = old.items.filter((item) => String(item.conversationId) !== targetId);
        if (nextItems.length === old.items.length) return old;
        return {
          ...old,
          items: nextItems,
          total: Math.max(0, Number(old.total || 0) - 1)
        };
      });
      return { snapshots };
    },
    onError: (err, _conversationId, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      setError(err.response?.data?.message || 'Impossible de supprimer.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
      queryClient.invalidateQueries({ queryKey: orderChatKeys.unread(userScopeId) });
    }
  });

  const buildOrderFromStart = useCallback(
    (conversationId, { sellerId, sellerName, productId, productTitle, productImage, productSlug } = {}) => ({
      _id: conversationId,
      conversationId,
      items: [
        {
          product: productId,
          snapshot: { shopId: sellerId, shopName: sellerName, title: productTitle, image: productImage, slug: productSlug }
        }
      ],
      customer: user?._id ? { _id: String(user._id) } : undefined,
      status: null,
      deliveryCode: null
    }),
    [user?._id]
  );

  const startConversationMutation = useMutation({
    mutationFn: async ({ sellerId, productId }) => startConversationRequest({ sellerId, productId }),
    onError: (err) => {
      setError(err.response?.data?.message || 'Impossible de démarrer la conversation.');
    }
  });

  // Start a conversation with a seller from a shop/product page — replaces
  // the old fake-draft-order "inquiry" hack now that a conversation doesn't
  // need an order to exist.
  useEffect(() => {
    const startRequest = location.state?.startConversation;
    if (!startRequest?.sellerId || !user) return;

    let cancelled = false;
    const openStartedConversation = async () => {
      setError('');
      try {
        const data = await startConversationMutation.mutateAsync(startRequest);
        if (cancelled) return;
        setSelectedOrder(buildOrderFromStart(data.conversationId, startRequest));
        queryClient.invalidateQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
        queryClient.invalidateQueries({ queryKey: orderChatKeys.unread(userScopeId) });
      } catch {
        // Error already surfaced via mutation onError.
      } finally {
        if (!cancelled) navigate(location.pathname, { replace: true, state: {} });
      }
    };
    openStartedConversation();
    return () => { cancelled = true; };
  }, [location.state?.startConversation, user]);

  const formatTimestamp = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = effectiveConversations.filter((conv) => {
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        conv.productInfo?.title?.toLowerCase().includes(query) ||
        conv.productInfo?.shopName?.toLowerCase().includes(query) ||
        conv.latestMessage?.text?.toLowerCase().includes(query) ||
        conv.orderCode?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Filter by type
    if (activeFilter === 'unread' && (!conv.unreadCount || conv.unreadCount === 0)) {
      return false;
    }

    return true;
  });

  const buildOrderFromConversation = useCallback((conv) => {
    const customerId = conv.customerId?._id ?? conv.customerId;
    return {
      _id: conv.orderId != null ? String(conv.orderId) : conv.orderId,
      conversationId: conv.conversationId,
      items: [{ snapshot: conv.productInfo }],
      customer: customerId != null ? { _id: String(customerId) } : undefined,
      status: conv.status,
      deliveryCode: conv.orderCode
    };
  }, []);

  const closeChat = () => {
    setSelectedOrder(null);
    queryClient.invalidateQueries({ queryKey: orderChatKeys.conversationsRoot(userScopeId) });
    queryClient.invalidateQueries({ queryKey: orderChatKeys.unread(userScopeId) });
  };

  const handleArchive = async (conversationId) => {
    if (!conversationId) return;
    setError('');
    await archiveConversationMutation.mutateAsync(conversationId).catch(() => {});
    setSelectedOrder(null);
  };

  const handleUnarchive = async (conversationId, e) => {
    if (!conversationId) return;
    e?.stopPropagation();
    setError('');
    await unarchiveConversationMutation.mutateAsync(conversationId).catch(() => {});
    setActiveFilter('all');
    setPage(1);
  };

  const handleDelete = async (conversationId) => {
    if (!conversationId) return;
    setError('');
    await deleteConversationMutation.mutateAsync(conversationId).catch(() => {});
    setSelectedOrder(null);
  };

  const openConversation = (conversation) => {
    setSelectedOrder(buildOrderFromConversation(conversation));
    setError('');
  };

  useEffect(() => {
    if (!requestedConversationId || !effectiveConversations.length) return;
    if (handledQueryOrderRef.current === requestedConversationId) return;
    const matchedConversation = effectiveConversations.find(
      (conversation) =>
        String(conversation?.conversationId || '') === requestedConversationId ||
        String(conversation?.orderId || '') === requestedConversationId
    );
    if (!matchedConversation) return;
    handledQueryOrderRef.current = requestedConversationId;
    setSelectedOrder(buildOrderFromConversation(matchedConversation));
    setError('');
  }, [requestedConversationId, effectiveConversations, buildOrderFromConversation]);

  useEffect(() => {
    if (!user?._id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return () => {};
    }

    let cancelled = false;
    let mountedSocket = null;

    const initSocket = async () => {
      const token = await storage.get('qm_token');
      if (!token || cancelled) return;
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const origin = apiBase.replace(/\/api\/?$/, '');
      const socket = io(origin, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 20,
        reconnectionDelay: 800
      });
      mountedSocket = socket;
      if (cancelled) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on('orders:unread:update', (payload) => {
        if (String(payload?.userId || '') !== String(userScopeId)) return;
        queryClient.setQueryData(orderChatKeys.unread(userScopeId), {
          unreadCount: Number(payload?.totalUnread || 0)
        });
        if (payload?.conversationId) {
          queryClient.setQueriesData(
            { queryKey: orderChatKeys.conversationsRoot(userScopeId) },
            (old) => {
              if (!old || !Array.isArray(old.items)) return old;
              return {
                ...old,
                items: old.items.map((conv) =>
                  String(conv.conversationId) === String(payload.conversationId)
                    ? { ...conv, unreadCount: Number(payload?.conversationUnread || 0) }
                    : conv
                )
              };
            }
          );
        }
      });

      socket.on('orders:conversation:updated', (payload) => {
        const conversationId = String(payload?.conversationId || '');
        if (!conversationId) return;
        const latestMessage = payload?.message || null;
        queryClient.setQueriesData(
          { queryKey: orderChatKeys.conversationsRoot(userScopeId) },
          (old) => {
            if (!old || !Array.isArray(old.items)) return old;
            if (!old.items.some((conv) => String(conv.conversationId) === conversationId)) {
              return old;
            }
            return {
              ...old,
              items: old.items
                .map((conv) => {
                  if (String(conv.conversationId) !== conversationId) return conv;
                  return {
                    ...conv,
                    latestMessage: latestMessage
                      ? {
                          _id: latestMessage._id,
                          text: latestMessage.text,
                          sender: latestMessage.sender,
                          createdAt: latestMessage.createdAt
                        }
                      : conv.latestMessage
                  };
                })
                .sort((a, b) => {
                  const aDate = a.latestMessage?.createdAt || a.createdAt;
                  const bDate = b.latestMessage?.createdAt || b.createdAt;
                  return new Date(bDate) - new Date(aDate);
                })
            };
          }
        );
      });
    };

    initSocket();

    return () => {
      cancelled = true;
      if (mountedSocket) {
        mountedSocket.disconnect();
      }
      if (socketRef.current === mountedSocket) {
        socketRef.current = null;
      }
    };
  }, [queryClient, userScopeId]);

  const inquiryLoading = startConversationMutation.isPending;

  if ((loading && effectiveConversations.length === 0 && !offlineSnapshotActive) || inquiryLoading) {
    return (
      <div className="hd-order-flow relative min-h-screen bg-[#f6f3ee] text-slate-950 dark:bg-neutral-950 dark:text-white">
        {inquiryLoading && (
          <BaseModal
            isOpen={inquiryLoading}
            onClose={() => {}}
            size="sm"
            mobileSheet
            closeOnEsc={false}
            closeOnBackdrop={false}
            ariaLabel="Ouverture conversation"
          >
            <ModalBody className="px-8 py-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#e85d00]" />
                <p className="text-center font-black text-slate-800 dark:text-gray-100">Ouverture de la conversation...</p>
              </div>
            </ModalBody>
          </BaseModal>
        )}
        {loading && conversations.length === 0 && !inquiryLoading && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-gray-200 border-t-[#e85d00]" />
                <p className="font-semibold text-slate-600 dark:text-gray-400">Chargement des conversations...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const emptyState = searchQuery
    ? {
        title: 'Aucun résultat',
        text: 'Aucune conversation ne correspond à votre recherche.'
      }
    : activeFilter === 'unread'
      ? {
          title: 'Tout est lu',
          text: "Vous n'avez aucun message en attente pour le moment."
        }
      : activeFilter === 'archived'
        ? {
            title: 'Aucune conversation archivée',
            text: 'Les conversations archivées apparaîtront ici.'
          }
        : {
            title: 'Pas encore de conversation',
            text: 'Écrivez à un vendeur depuis une fiche produit, ou reprenez une commande en cours.'
          };

  return (
    <div className="hd-order-flow min-h-screen bg-[#f6f3ee] text-[#141210] dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-3 pb-28 sm:px-6">
        <header className="px-2 pb-3 pt-5 sm:px-0 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[28px] font-black leading-none tracking-[-0.03em] text-[#141210] dark:text-white">
              Messagerie
            </h1>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setActiveFilter(activeFilter === 'archived' ? 'all' : 'archived');
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#57534e] ring-1 transition hover:text-[#e85d00] dark:bg-neutral-900 dark:text-neutral-300 ${
                activeFilter === 'archived'
                  ? 'ring-[#e85d00] text-[#e85d00]'
                  : 'ring-[#e7dfd5] dark:ring-neutral-800'
              }`}
              aria-label={activeFilter === 'archived' ? 'Afficher toutes les conversations' : 'Afficher les conversations archivées'}
              title="Conversations archivées"
            >
              <ArchiveBoxIcon className="h-[19px] w-[19px]" />
            </button>
          </div>
          <p className="mt-1 text-sm font-medium text-[#78716c] dark:text-neutral-400">
            {effectiveTotalUnread > 0
              ? `${effectiveTotalUnread} message${effectiveTotalUnread > 1 ? 's' : ''} en attente de vous`
              : `${effectiveMeta.total} conversation${effectiveMeta.total !== 1 ? 's' : ''}`}
          </p>

          <div className="relative mt-3.5">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a8a29e]" />
            <input
              type="search"
              placeholder="Rechercher un produit, une boutique…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 w-full rounded-[14px] border-0 bg-white py-2 pl-[42px] pr-10 text-[15px] font-medium text-[#141210] placeholder:text-[#a8a29e] ring-1 ring-[#e7dfd5] transition focus:outline-none focus:ring-2 focus:ring-[#e85d00]/25 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#a8a29e] transition hover:bg-[#f6f3ee] hover:text-[#e85d00] dark:hover:bg-neutral-800"
                aria-label="Effacer la recherche"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 inline-flex max-w-full overflow-x-auto rounded-xl bg-[#ece5db] p-[3px] [scrollbar-width:none] dark:bg-neutral-800 [&::-webkit-scrollbar]:hidden">
            {[
              { value: 'all', label: 'Tous' },
              {
                value: 'unread',
                label: `Non lus${effectiveTotalUnread > 0 ? ` · ${effectiveTotalUnread > 99 ? '99+' : effectiveTotalUnread}` : ''}`
              },
              { value: 'archived', label: 'Archivées' }
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => {
                  setPage(1);
                  setActiveFilter(filter.value);
                }}
                className={`shrink-0 rounded-[9px] px-4 py-[7px] text-sm transition ${
                  activeFilter === filter.value
                    ? 'bg-white font-bold text-[#141210] shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'font-semibold text-[#78716c] hover:text-[#141210] dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>

        {(offlineSnapshotActive || rapid3GActive) && (
          <section
            className={`mx-1 mb-3 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${
              offlineSnapshotActive
                ? 'bg-amber-50 text-amber-800 ring-amber-100'
                : 'bg-sky-50 text-sky-800 ring-sky-100'
            }`}
          >
            <p className="font-semibold">
              {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        )}

        {error && !offlineSnapshotActive && (
          <div className="mx-1 mb-4">
            <NetworkFallbackCard
              title="Impossible de charger les conversations"
              message="Les conversations mettent plus de temps à charger. Réessayez dans un instant."
              onRetry={() => {
                setError('');
                conversationsQuery.refetch();
                unreadQuery.refetch();
              }}
              retryLabel="Réessayer"
              refreshLabel="Actualiser la page"
            />
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-[#ece5db] dark:bg-neutral-900 dark:ring-neutral-800">
            {filteredConversations.length === 0 ? (
              <div className="flex min-h-[460px] flex-1 flex-col items-center justify-center px-10 pb-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white text-[#e85d00] ring-1 ring-[#ece5db] dark:bg-neutral-800 dark:ring-neutral-700">
                  <ChatBubbleLeftIcon className="h-[30px] w-[30px]" />
                </div>
                <h2 className="mt-[18px] text-[19px] font-extrabold text-[#141210] dark:text-white">
                  {emptyState.title}
                </h2>
                <p className="mt-2 max-w-sm text-[14.5px] font-medium leading-[1.55] text-[#78716c] dark:text-neutral-400">
                  {emptyState.text}
                </p>
                {!searchQuery && activeFilter === 'all' ? (
                  <div className="mt-[22px] flex w-full max-w-sm flex-col gap-2.5">
                    <Link
                      to="/orders"
                      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-[15px] font-extrabold text-white transition hover:bg-[#f45f00]"
                    >
                      <CubeIcon className="h-[18px] w-[18px]" />
                      Voir mes commandes
                    </Link>
                    <Link
                      to="/shops/verified"
                      className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-[15px] font-bold text-[#141210] ring-1 ring-[#e7dfd5] transition hover:text-[#e85d00] dark:bg-neutral-800 dark:text-white dark:ring-neutral-700"
                    >
                      Explorer les boutiques
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('all');
                      setPage(1);
                    }}
                    className="mt-[22px] min-h-11 rounded-2xl bg-white px-5 text-sm font-bold text-[#141210] ring-1 ring-[#e7dfd5] transition hover:text-[#e85d00] dark:bg-neutral-800 dark:text-white dark:ring-neutral-700"
                  >
                    Voir toutes les conversations
                  </button>
                )}
                <p className="mt-[26px] flex items-center gap-1.5 text-xs font-medium text-[#a8a29e]">
                  <LockClosedIcon className="h-[13px] w-[13px]" />
                  Messages chiffrés
                </p>
              </div>
            ) : (
              <div>
            {filteredConversations.map((conversation) => {
              const displayStatus = conversation.isInquiry ? 'inquiry' : conversation.status;
              const actionNote = ACTION_NOTES[displayStatus] || null;
              const ActionNoteIcon = actionNote?.icon;
              const hasUnread = conversation.unreadCount > 0;

              // Determine if user is customer or seller for display
              const isAdmin = user?.role === 'admin' || user?.role === 'founder' || user?.role === 'manager';
              const isCustomer = conversation.customerId && String(conversation.customerId) === String(user?._id);
              const isSeller = conversation.sellerId && String(conversation.sellerId) === String(user?._id);

              // Client/partner name: show customer name for seller/admin, shop name for customer
              let partnerName = conversation.productInfo?.shopName || 'Vendeur';
              if (isAdmin || isSeller) {
                partnerName = conversation.customerName || 'Client';
              } else if (isCustomer) {
                partnerName = conversation.productInfo?.shopName || 'Vendeur';
              }

              const isSelected =
                selectedOrder && String(selectedOrder.conversationId) === String(conversation.conversationId);

              return (
                <div
                  key={conversation.conversationId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openConversation(conversation)}
                  onKeyDown={(e) => e.key === 'Enter' && openConversation(conversation)}
                  className={`group flex cursor-pointer items-start gap-3 border-b border-[#f4efe8] px-4 py-3.5 outline-none transition last:border-b-0 hover:bg-[#fffaf3] focus-visible:bg-[#fffaf3] dark:border-neutral-800 dark:hover:bg-neutral-800 ${isSelected ? 'bg-[#fffaf3] dark:bg-neutral-800' : ''}`}
                >
                    <div className="shrink-0">
                      {conversation.productInfo?.image ? (
                        <img
                          src={conversation.productInfo.image}
                          alt=""
                          className="h-[46px] w-[46px] rounded-[14px] object-cover"
                        />
                      ) : (
                        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#f6f3ee] dark:bg-neutral-800">
                          <CubeIcon className="h-5 w-5 text-[#e85d00]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className={`min-w-0 flex-1 truncate text-[15px] text-[#141210] dark:text-white ${hasUnread ? 'font-extrabold' : 'font-semibold'}`}>
                          {partnerName}
                        </p>
                        <time className={`shrink-0 text-xs font-medium ${hasUnread ? 'text-[#e85d00]' : 'text-[#a8a29e]'}`}>
                          {formatTimestamp(conversation.latestMessage?.createdAt || conversation.createdAt)}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-[13px] font-medium text-[#78716c] dark:text-neutral-400">
                        {conversation.productInfo?.title || 'Produit'}
                      </p>
                      {conversation.latestMessage ? (
                        <p className={`mt-1 truncate text-sm ${hasUnread ? 'font-semibold text-[#3f3a34] dark:text-neutral-200' : 'font-medium text-[#8a8378] dark:text-neutral-400'}`}>
                          {conversation.latestMessage.text}
                        </p>
                      ) : (
                        <p className="mt-1 truncate text-sm font-medium italic text-[#a8a29e]">Aucun message</p>
                      )}
                      {actionNote && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[#b3480a] dark:text-orange-300">
                          <ActionNoteIcon className="h-[13px] w-[13px]" />
                          {actionNote.label}
                        </p>
                      )}
                      {activeFilter === 'archived' && (
                        <button
                          type="button"
                          onClick={(e) => handleUnarchive(conversation.conversationId, e)}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-[#b3480a] transition hover:text-[#e85d00]"
                        >
                          <ArchiveBoxArrowDownIcon className="h-[13px] w-[13px]" />
                          Désarchiver
                        </button>
                      )}
                    </div>
                    {hasUnread && <span className="mt-2 h-[9px] w-[9px] shrink-0 rounded-full bg-[#e85d00]" aria-label="Non lu" />}
                </div>
              );
            })}
              </div>
            )}
          </div>
        </main>

        {filteredConversations.length > 0 && effectiveMeta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-medium text-[#78716c] dark:text-neutral-400">
              Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> sur{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{effectiveMeta.totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#57534e] ring-1 ring-[#e7dfd5] transition hover:text-[#e85d00] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(effectiveMeta.totalPages, prev + 1))}
                disabled={page >= effectiveMeta.totalPages}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#57534e] ring-1 ring-[#e7dfd5] transition hover:text-[#e85d00] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Modal - single instance, opens when a conversation is selected */}
      {selectedOrder && (
        <OrderChat
          order={selectedOrder}
          conversationId={selectedOrder?.conversationId}
          onClose={closeChat}
          defaultOpen
          buttonText="Contacter"
          unreadCount={0}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
