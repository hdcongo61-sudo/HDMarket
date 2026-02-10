import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Package,
  Clock,
  CheckCircle,
  Truck,
  X,
  Search,
  Filter,
  ArrowLeft,
  Shield,
  Lock,
  ChevronRight,
  Inbox,
  Bell,
  Settings,
  MoreHorizontal,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  Pin,
  CheckCheck,
  Check
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import OrderChat from '../components/OrderChat';
import { buildProductPath } from '../utils/links';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivering: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  inquiry: 'Demande'
};

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  confirmed: 'bg-amber-100 text-amber-800 border-amber-200',
  delivering: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  inquiry: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700'
};

const STATUS_ICONS = {
  pending: Clock,
  confirmed: Package,
  delivering: Truck,
  delivered: CheckCircle,
  cancelled: X,
  inquiry: MessageCircle
};

const PAGE_SIZE = 12;

export default function OrderMessages() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, unread, archived
  const [totalUnread, setTotalUnread] = useState(0);
  const [inquiryLoading, setInquiryLoading] = useState(false);

  useEffect(() => {
    loadConversations();
    loadUnreadCount();
  }, [page, activeFilter]);

  // Alibaba-style: start a conversation with product context when coming from product page
  useEffect(() => {
    const inquireProduct = location.state?.inquireProduct;
    if (!inquireProduct?._id || !user) return;

    let cancelled = false;
    const createAndOpenInquiry = async () => {
      setInquiryLoading(true);
      setError('');
      try {
        const { data } = await api.post('/orders/inquiry', { productId: inquireProduct._id });
        if (cancelled) return;
        setSelectedOrder(data);
        await loadConversations();
        loadUnreadCount();
        navigate(location.pathname, { replace: true, state: {} });
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Impossible de démarrer la conversation.');
        navigate(location.pathname, { replace: true, state: {} });
      } finally {
        if (!cancelled) setInquiryLoading(false);
      }
    };
    createAndOpenInquiry();
    return () => { cancelled = true; };
  }, [location.state?.inquireProduct?._id, user]);

  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);
      params.set('archived', activeFilter === 'archived' ? 'true' : 'false');

      const { data } = await api.get(`/orders/messages/conversations?${params.toString()}`);
      setConversations(Array.isArray(data.items) ? data.items : []);
      setMeta({
        total: data.total || 0,
        totalPages: data.totalPages || 1
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les conversations.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const { data } = await api.get('/orders/messages/unread');
      setTotalUnread(data.unreadCount ?? data.count ?? 0);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const filteredConversations = conversations.filter((conv) => {
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

  const closeChat = () => {
    setSelectedOrder(null);
    loadConversations();
    loadUnreadCount();
  };

  const handleArchive = async (orderId) => {
    try {
      await api.post(`/orders/${String(orderId)}/archive`);
      setSelectedOrder(null);
      loadConversations();
      loadUnreadCount();
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible d\'archiver.');
    }
  };

  const handleUnarchive = async (orderId, e) => {
    e?.stopPropagation();
    try {
      await api.post(`/orders/${String(orderId)}/unarchive`);
      setActiveFilter('all');
      setPage(1);
      loadUnreadCount();
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de désarchiver.');
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await api.post(`/orders/${String(orderId)}/delete`);
      setSelectedOrder(null);
      loadConversations();
      loadUnreadCount();
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de supprimer.');
    }
  };

  const buildOrderFromConversation = (conv) => {
    const customerId = conv.customerId?._id ?? conv.customerId;
    return {
      _id: conv.orderId != null ? String(conv.orderId) : conv.orderId,
      items: [{ snapshot: conv.productInfo }],
      customer: customerId != null ? { _id: String(customerId) } : undefined,
      status: conv.status,
      deliveryCode: conv.orderCode
    };
  };

  const openConversation = (conversation) => {
    setSelectedOrder(buildOrderFromConversation(conversation));
    setError('');
  };

  if ((loading && conversations.length === 0) || inquiryLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
        {inquiryLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-700 dark:text-gray-200 font-medium">Ouverture de la conversation avec le vendeur...</p>
            </div>
          </div>
        )}
        {loading && conversations.length === 0 && !inquiryLoading && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Chargement des conversations...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      {/* Header: breadcrumb + title + stats */}
      <header className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 mb-3">
            <Link to="/" className="hover:text-slate-700 dark:hover:text-gray-200 transition-colors">Accueil</Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <Link to="/orders" className="hover:text-slate-700 dark:hover:text-gray-200 transition-colors">Commandes</Link>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <span className="text-slate-900 dark:text-white font-medium">Messagerie</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Messagerie</h1>
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                  {meta.total} conversation{meta.total !== 1 ? 's' : ''}
                  {totalUnread > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      · {totalUnread} non lu{totalUnread !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 text-sm">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>Messages sécurisés</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Toolbar: search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par produit, boutique ou message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-gray-700"
                aria-label="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setPage(1); setActiveFilter('all'); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Inbox className="w-4 h-4" />
                Tous
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setPage(1); setActiveFilter('unread'); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === 'unread'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Bell className="w-4 h-4" />
                Non lus
                {totalUnread > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setPage(1); setActiveFilter('archived'); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === 'archived'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Archive className="w-4 h-4" />
                Archivées
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 flex-shrink-0">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main: two-column on desktop, single column on mobile */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[calc(100vh-16rem)]">
          {/* Conversations list */}
          <div className={`${selectedOrder ? 'hidden lg:block lg:w-[400px] xl:w-[420px] flex-shrink-0' : 'w-full'} flex flex-col`}>
            {filteredConversations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-8 sm:p-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-5">
                  <MessageCircle className="w-10 h-10 text-slate-400 dark:text-gray-500" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Aucune conversation</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                  {searchQuery
                    ? 'Aucune conversation ne correspond à votre recherche.'
                    : activeFilter === 'unread'
                      ? 'Vous avez lu tous vos messages.'
                      : 'Démarrez une conversation depuis une fiche produit ou une commande.'}
                </p>
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Voir mes commandes
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const displayStatus = conversation.isInquiry ? 'inquiry' : conversation.status;
              const StatusIcon = STATUS_ICONS[displayStatus] || Clock;
              const statusStyle = STATUS_STYLES[displayStatus] || STATUS_STYLES.pending;
              const hasUnread = conversation.unreadCount > 0;

              // Determine if user is customer or seller for display
              const isAdmin = user?.role === 'admin' || user?.role === 'manager';
              const isCustomer = conversation.customerId && String(conversation.customerId) === String(user?._id);
              const isSeller = conversation.sellerId && String(conversation.sellerId) === String(user?._id);

              // Client/partner name: show customer name for seller/admin, shop name for customer
              let partnerName = conversation.productInfo?.shopName || 'Vendeur';
              let buttonText = 'Contacter le vendeur';
              if (isAdmin || isSeller) {
                partnerName = conversation.customerName || 'Client';
                buttonText = "Contacter l'acheteur";
              } else if (isCustomer) {
                partnerName = conversation.productInfo?.shopName || 'Vendeur';
                buttonText = 'Contacter le vendeur';
              }
              const productPath = conversation.productInfo?.slug
                ? buildProductPath(conversation.productInfo)
                : null;

              const isSelected = selectedOrder && String(selectedOrder._id) === String(conversation.orderId);

              return (
                <div
                  key={conversation.orderId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openConversation(conversation)}
                  onKeyDown={(e) => e.key === 'Enter' && openConversation(conversation)}
                  className={`group rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/30'
                      : hasUnread
                        ? 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50/50 dark:hover:bg-gray-700/50'
                        : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-50/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="p-3 sm:p-4 flex gap-3">
                    <div className="relative flex-shrink-0">
                      {conversation.productInfo?.image ? (
                        <img
                          src={conversation.productInfo.image}
                          alt=""
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                          <Package className="w-7 h-7 text-slate-400 dark:text-gray-500" />
                        </div>
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {productPath ? (
                            <Link
                              to={productPath}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-sm font-semibold truncate block ${hasUnread ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-gray-100'} hover:text-indigo-600 dark:hover:text-indigo-400`}
                            >
                              {conversation.productInfo?.title || 'Produit'}
                            </Link>
                          ) : (
                            <p className={`text-sm font-semibold truncate ${hasUnread ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-gray-100'}`}>
                              {conversation.productInfo?.title || 'Produit'}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            {partnerName} · #{conversation.orderCode || String(conversation.orderId || '').slice(-6)}
                          </p>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${statusStyle}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {STATUS_LABELS[displayStatus] || '—'}
                        </div>
                      </div>
                      {conversation.latestMessage ? (
                        <p className={`text-xs mt-1.5 line-clamp-2 ${hasUnread ? 'text-slate-700 dark:text-gray-200 font-medium' : 'text-slate-500 dark:text-gray-400'}`}>
                          {conversation.latestMessage.text}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-gray-500 italic mt-1.5">Aucun message</p>
                      )}
                      <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">
                        {formatTimestamp(conversation.latestMessage?.createdAt)}
                      </p>
                      {activeFilter === 'archived' && (
                        <button
                          type="button"
                          onClick={(e) => handleUnarchive(conversation.orderId, e)}
                          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-colors"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Désarchiver
                        </button>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-gray-600 flex-shrink-0 self-center group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>

          {/* Right: chat modal opens on top; on desktop list stays visible */}
        </div>

        {/* Pagination */}
        {filteredConversations.length > 0 && meta.totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> sur{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{meta.totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                disabled={page >= meta.totalPages}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 text-xs">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Tous vos messages sont chiffrés et sécurisés</span>
          </div>
        </footer>
      </div>

      {/* Chat Modal - single instance, opens when a conversation is selected */}
      {selectedOrder && (
        <OrderChat
          order={selectedOrder}
          onClose={closeChat}
          defaultOpen
          buttonText="Contacter"
          unreadCount={0}
          onArchive={() => handleArchive(selectedOrder._id)}
          onDelete={() => handleDelete(selectedOrder._id)}
        />
      )}
    </div>
  );
}
