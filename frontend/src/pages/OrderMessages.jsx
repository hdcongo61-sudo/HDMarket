import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Trash2,
  Pin,
  CheckCheck,
  Check
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import OrderChat from '../components/OrderChat';

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  delivering: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  confirmed: 'bg-amber-100 text-amber-800 border-amber-200',
  delivering: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_ICONS = {
  pending: Clock,
  confirmed: Package,
  delivering: Truck,
  delivered: CheckCircle,
  cancelled: X
};

const PAGE_SIZE = 12;

export default function OrderMessages() {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, unread, starred
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    loadConversations();
    loadUnreadCount();
  }, [page]);

  const loadConversations = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', PAGE_SIZE);

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
      setTotalUnread(data.count || 0);
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

  if (loading && conversations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Chargement des conversations...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/orders"
                className="p-2 rounded-xl hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Messages</h1>
                  <p className="text-sm text-white/80">
                    {meta.total} conversation{meta.total > 1 ? 's' : ''} • {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Security Badge */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <Lock className="w-4 h-4 text-emerald-300" />
              <span className="text-sm">Messages sécurisés</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par produit, boutique, message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  Tous
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unread')}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeFilter === 'unread'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Non lus
                  {totalUnread > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs">
                      {totalUnread}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Conversations List */}
        {filteredConversations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-12 h-12 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Aucune conversation</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {searchQuery
                ? 'Aucune conversation ne correspond à votre recherche.'
                : activeFilter === 'unread'
                  ? 'Vous avez lu tous vos messages.'
                  : "Vous n'avez pas encore de messages. Commencez une conversation depuis une commande."}
            </p>
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
            >
              <Package className="w-5 h-5" />
              Voir mes commandes
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conversation) => {
              const StatusIcon = STATUS_ICONS[conversation.status] || Clock;
              const statusStyle = STATUS_STYLES[conversation.status] || STATUS_STYLES.pending;
              const hasUnread = conversation.unreadCount > 0;

              // Determine if user is customer or seller for display
              const isAdmin = user?.role === 'admin' || user?.role === 'manager';
              const isCustomer = conversation.customerId && String(conversation.customerId) === String(user?._id);
              const isSeller = conversation.sellerId && String(conversation.sellerId) === String(user?._id);

              let partnerName = conversation.productInfo?.shopName || 'Vendeur';
              let buttonText = 'Contacter le vendeur';
              if (isAdmin) {
                partnerName = 'Client';
                buttonText = "Contacter l'acheteur";
              } else if (isSeller) {
                partnerName = 'Client';
                buttonText = "Contacter l'acheteur";
              } else if (isCustomer) {
                partnerName = conversation.productInfo?.shopName || 'Vendeur';
                buttonText = 'Contacter le vendeur';
              }

              return (
                <div
                  key={conversation.orderId}
                  className={`group bg-white dark:bg-gray-800 rounded-2xl border-2 transition-all duration-300 hover:shadow-lg cursor-pointer ${
                    hasUnread
                      ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10'
                      : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-800'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="relative flex-shrink-0">
                        {conversation.productInfo?.image ? (
                          <img
                            src={conversation.productInfo.image}
                            alt={conversation.productInfo.title}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                            <Package className="w-8 h-8 text-indigo-500" />
                          </div>
                        )}
                        {/* Unread Badge */}
                        {hasUnread && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg animate-pulse">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-gray-900 dark:text-white truncate ${hasUnread ? 'text-indigo-900 dark:text-indigo-100' : ''}`}>
                              {conversation.productInfo?.title || 'Produit'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              <span>{partnerName}</span>
                              <span>•</span>
                              <span>#{conversation.orderCode}</span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusStyle}`}>
                            <StatusIcon className="w-3 h-3" />
                            {STATUS_LABELS[conversation.status] || 'Inconnu'}
                          </div>
                        </div>

                        {/* Latest Message */}
                        {conversation.latestMessage ? (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${hasUnread ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {conversation.latestMessage.sender?.shopName ||
                                  conversation.latestMessage.sender?.name ||
                                  'Utilisateur'}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {formatTimestamp(conversation.latestMessage.createdAt)}
                              </span>
                            </div>
                            <p className={`text-sm line-clamp-2 ${hasUnread ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-300'}`}>
                              {conversation.latestMessage.text}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 dark:text-gray-500 italic mt-2">
                            Aucun message pour le moment
                          </p>
                        )}

                        {/* Mobile Status Badge */}
                        <div className={`sm:hidden inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold mt-2 ${statusStyle}`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_LABELS[conversation.status] || 'Inconnu'}
                        </div>

                        {/* Action Button */}
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <OrderChat
                            order={{
                              _id: conversation.orderId,
                              items: [{ snapshot: conversation.productInfo }],
                              customer: { _id: conversation.customerId || user?._id },
                              status: conversation.status,
                              deliveryCode: conversation.orderCode
                            }}
                            buttonText={buttonText}
                            unreadCount={conversation.unreadCount || 0}
                            onClose={closeChat}
                          />
                        </div>
                      </div>

                      {/* Chevron */}
                      <div className="hidden sm:flex items-center">
                        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page <span className="font-bold text-gray-900 dark:text-white">{page}</span> sur{' '}
              <span className="font-bold text-gray-900 dark:text-white">{meta.totalPages}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(meta.totalPages, prev + 1))}
                disabled={page >= meta.totalPages}
                className="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Suivant
              </button>
            </div>
          </div>
        )}

        {/* Security Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Tous vos messages sont chiffrés et sécurisés</span>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {selectedOrder && <OrderChat order={selectedOrder} onClose={closeChat} />}
    </div>
  );
}
