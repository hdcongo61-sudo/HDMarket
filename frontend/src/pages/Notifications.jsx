import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Users, Bell, Settings, Check, X, Trash2, Filter, ChevronDown, Clock, MessageSquare, Heart, Package, ShoppingBag, AlertCircle, CheckCircle2, XCircle, Tag, Store, CreditCard, Truck, Timer, BellRing, Archive, Sparkles, ChevronRight } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import useUserNotifications, { triggerNotificationsRefresh } from '../hooks/useUserNotifications';
import useIsMobile from '../hooks/useIsMobile';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  product_comment: true,
  reply: true,
  favorite: true,
  rating: true,
  product_approval: true,
  product_rejection: true,
  promotional: true,
  shop_review: true,
  shop_follow: true,
  payment_pending: true,
  order_created: true,
  order_received: true,
  order_reminder: true,
  order_delivering: true,
  order_delivered: true,
  order_cancelled: true,
  feedback_read: true,
  complaint_created: true,
  improvement_feedback_created: true,
  admin_broadcast: true,
  account_restriction: true,
  account_restriction_lifted: true,
  shop_conversion_approved: true,
  shop_conversion_rejected: true
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined
  });
};

// Notification preferences component
const NotificationPreferences = ({ preferences, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile(768);

  const handleToggle = async (type) => {
    setSaving(true);
    const updated = { ...preferences, [type]: !preferences[type] };
    try {
      const { data } = await api.patch('/users/notification-preferences', updated);
      onUpdate(data?.preferences ?? updated);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
      >
        <Settings className="w-4 h-4" />
        <span className="hidden sm:inline">Préférences</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`z-50 overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 ${
              isMobile
                ? 'fixed left-1/2 -translate-x-1/2 top-[4.5rem] w-[calc(100vw-2rem)] max-w-sm'
                : 'absolute right-0 top-full mt-2 w-80 sm:w-96'
            }`}
          >
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-purple-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Préférences
                  </h3>
                  <p className="text-indigo-100 text-xs mt-1">Personnalisez vos alertes</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-1.5">
              {[
                { key: 'product_comment', label: 'Nouveaux commentaires', icon: MessageSquare },
                { key: 'reply', label: 'Réponses à mes commentaires', icon: MessageSquare },
                { key: 'favorite', label: 'Ajouts aux favoris', icon: Heart },
                { key: 'rating', label: 'Nouvelles notes', icon: Star },
                { key: 'product_approval', label: "Approbations d'annonce", icon: CheckCircle2 },
                { key: 'product_rejection', label: "Rejets d'annonce", icon: XCircle },
                { key: 'promotional', label: 'Promotions appliquées', icon: Tag },
                { key: 'shop_review', label: 'Avis sur ma boutique', icon: Star },
                { key: 'shop_follow', label: 'Nouveaux abonnés', icon: Users },
                { key: 'payment_pending', label: 'Paiements à valider', icon: CreditCard },
                { key: 'order_created', label: 'Commandes confirmées', icon: ShoppingBag },
                { key: 'order_delivering', label: 'Commandes en livraison', icon: Truck },
                { key: 'order_received', label: 'Nouvelles commandes', icon: Package },
                { key: 'order_reminder', label: 'Relances commandes', icon: Timer },
                { key: 'order_delivered', label: 'Commandes livrées', icon: CheckCircle2 },
                { key: 'order_cancelled', label: 'Commandes annulées', icon: XCircle },
                { key: 'feedback_read', label: 'Avis lus', icon: Check },
                { key: 'complaint_created', label: 'Nouvelles réclamations', icon: AlertCircle },
                { key: 'improvement_feedback_created', label: 'Nouveaux avis d\'amélioration', icon: MessageSquare },
                { key: 'admin_broadcast', label: 'Messages de l\'équipe', icon: Bell },
                { key: 'account_restriction', label: 'Restrictions de compte', icon: AlertCircle },
                { key: 'account_restriction_lifted', label: 'Restrictions levées', icon: CheckCircle2 },
                { key: 'shop_conversion_approved', label: 'Demande boutique acceptée', icon: CheckCircle2 },
                { key: 'shop_conversion_rejected', label: 'Demande boutique refusée', icon: XCircle }
              ].map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      preferences[key]
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                  </div>
                  <button
                    onClick={() => handleToggle(key)}
                    disabled={saving}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                      preferences[key]
                        ? 'bg-indigo-600 dark:bg-indigo-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                        preferences[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { counts, loading, error, refresh, updateCounts } = useUserNotifications(Boolean(user), { skipRefreshEvent: true });
  const alerts = counts.alerts || [];
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [preferences, setPreferences] = useState(() => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const isMobile = useIsMobile(768);

  useEffect(() => {
    if (counts?.preferences) {
      const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
      Object.keys(merged).forEach((key) => {
        if (typeof counts.preferences[key] === 'boolean') {
          merged[key] = counts.preferences[key];
        }
      });
      setPreferences((prev) => {
        const hasChanges = Object.keys(merged).some((key) => merged[key] !== prev[key]);
        return hasChanges ? merged : prev;
      });
    }
  }, [counts?.preferences]);

  const typeConfig = {
    product_comment: {
      label: 'Commentaire',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      icon: <MessageSquare className="w-4 h-4" />
    },
    reply: {
      label: 'Réponse',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      icon: <MessageSquare className="w-4 h-4" />
    },
    favorite: {
      label: 'Favori',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
      icon: <Heart className="w-4 h-4" />
    },
    rating: {
      label: 'Note',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      icon: <Star className="w-4 h-4" />
    },
    product_approval: {
      label: 'Approbation',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    product_rejection: {
      label: 'Rejet',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      icon: <XCircle className="w-4 h-4" />
    },
    promotional: {
      label: 'Promotion',
      badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      icon: <Tag className="w-4 h-4" />
    },
    shop_review: {
      label: 'Avis boutique',
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      icon: <Store className="w-4 h-4" />
    },
    shop_follow: {
      label: 'Abonnés boutique',
      badgeClass: 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
      icon: <Users className="w-4 h-4" />
    },
    payment_pending: {
      label: 'Paiement en attente',
      badgeClass: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
      icon: <CreditCard className="w-4 h-4" />
    },
    order_created: {
      label: 'Commande en attente',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      icon: <ShoppingBag className="w-4 h-4" />
    },
    order_delivering: {
      label: 'Commande en livraison',
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
      icon: <Truck className="w-4 h-4" />
    },
    order_received: {
      label: 'Nouvelle commande',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      icon: <Package className="w-4 h-4" />
    },
    order_reminder: {
      label: 'Relance commande',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
      icon: <Timer className="w-4 h-4" />
    },
    order_delivered: {
      label: 'Commande livrée',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    order_cancelled: {
      label: 'Commande annulée',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      icon: <XCircle className="w-4 h-4" />
    },
    feedback_read: {
      label: 'Avis lu',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      icon: <Check className="w-4 h-4" />
    },
    complaint_created: {
      label: 'Nouvelle réclamation',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
      icon: <AlertCircle className="w-4 h-4" />
    },
    improvement_feedback_created: {
      label: 'Nouvel avis d\'amélioration',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
      icon: <MessageSquare className="w-4 h-4" />
    },
    admin_broadcast: {
      label: 'Message de l\'équipe',
      badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
      icon: <Bell className="w-4 h-4" />
    },
    account_restriction: {
      label: 'Restriction de compte',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      icon: <AlertCircle className="w-4 h-4" />
    },
    account_restriction_lifted: {
      label: 'Restriction levée',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    shop_conversion_approved: {
      label: 'Demande boutique acceptée',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      icon: <CheckCircle2 className="w-4 h-4" />
    },
    shop_conversion_rejected: {
      label: 'Demande boutique refusée',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      icon: <XCircle className="w-4 h-4" />
    }
  };

  const filteredAlerts = useMemo(() => {
    let filtered = alerts;

    if (activeFilter === 'all') {
      filtered = filtered.filter((alert) => preferences[alert.type] !== false);
    } else if (activeFilter === 'unread') {
      filtered = filtered
        .filter((alert) => preferences[alert.type] !== false)
        .filter((alert) => alert.isNew);
    } else {
      filtered = filtered.filter((alert) => alert.type === activeFilter);
    }

    return filtered;
  }, [alerts, preferences, activeFilter]);

  const unreadAlerts = useMemo(() => filteredAlerts.filter((alert) => alert.isNew), [filteredAlerts]);
  const readAlerts = useMemo(() => filteredAlerts.filter((alert) => !alert.isNew), [filteredAlerts]);

  const renderAlert = (alert, isUnread, isGrouped = false) => {
    const productStatus = alert.product?.status;
    const config = typeConfig[alert.type] || {
      label: 'Notification',
      badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
      icon: <Bell className="w-4 h-4" />
    };

    return (
      <div
        key={alert._id}
        className={`group relative transition-all duration-200 overflow-hidden ${
          isGrouped
            ? `border-b border-gray-100 dark:border-gray-700/80 last:border-b-0 ${isUnread ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'bg-white dark:bg-gray-800'}`
            : `rounded-2xl ${
                isUnread
                  ? 'bg-gradient-to-br from-white via-white to-indigo-50/30 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-900/10 border-2 border-indigo-300 dark:border-indigo-700 shadow-md hover:shadow-xl'
                  : 'bg-white/80 dark:bg-gray-800/80 border-2 border-gray-200/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600'
              }`
        }`}
      >
        {/* Unread indicator: bar (desktop) or dot (grouped/mobile) */}
        {isUnread && !isGrouped && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
        )}

        <div className={isGrouped ? 'pl-4 pr-4 py-3.5 flex gap-3' : 'p-4 sm:p-5'}>
          {isGrouped && isUnread && (
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" aria-hidden />
          )}
          <div className={`flex flex-col gap-3 sm:gap-4 ${isGrouped ? 'flex-1 min-w-0' : ''}`}>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2.5 sm:mb-3">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${config.badgeClass}`}>
                    {config.icon}
                    <span className="hidden sm:inline">{config.label}</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  {isUnread && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="hidden sm:inline">Nouveau</span>
                    </span>
                  )}
                </div>

                {/* Action buttons — always visible, engaging */}
                <div className="flex items-center gap-1.5">
                  {isUnread && (
                    <button
                      onClick={() => handleMarkRead([alert._id])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all duration-200 active:scale-95"
                      title="Marquer comme lu"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline">Marquer lu</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNotification(alert._id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg border border-red-200 dark:border-red-800 transition-all duration-200 active:scale-95"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                </div>
              </div>

              {/* User info */}
              {alert.user?.name && (
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white dark:ring-gray-800">
                    {alert.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{alert.user.name}</span>
                </div>
              )}

              {/* Parent message for replies */}
              {alert.type === 'reply' && alert.parent?.message && (
                <div className="mb-3.5 p-3.5 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl border-l-4 border-indigo-400">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Votre commentaire
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">"{alert.parent.message}"</p>
                </div>
              )}

              {/* Main message */}
              <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed mb-3.5 font-medium">{alert.message}</p>

              {alert.type === 'shop_review' && alert.metadata?.rating && (
                <div className="flex items-center gap-2 mb-3 px-3.5 py-2.5 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    Note : {Number(alert.metadata.rating).toFixed(1)}/5
                  </span>
                </div>
              )}

              {alert.type === 'shop_review' && alert.metadata?.comment && (
                <div className="p-3.5 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-xl border-l-4 border-indigo-400 mb-3.5">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Commentaire
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">"{alert.metadata.comment}"</p>
                </div>
              )}

              {alert.type === 'payment_pending' && (user?.role === 'admin' || user?.role === 'manager') && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                  <Link
                    to="/admin/payment-verification"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="truncate">Vérifier paiements</span>
                  </Link>
                </div>
              )}

              {alert.type === 'complaint_created' && (user?.role === 'admin' || user?.role === 'manager' || user?.canManageComplaints) && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                  <Link
                    to="/admin/complaints"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-700 dark:text-rose-400 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/20 dark:to-rose-900/10 hover:from-rose-100 dark:hover:from-rose-900/30 transition-all duration-200 border-2 border-rose-200 dark:border-rose-800 active:scale-95"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="truncate">Traiter les réclamations</span>
                  </Link>
                </div>
              )}

              {alert.type === 'improvement_feedback_created' && (user?.role === 'admin' || user?.canReadFeedback) && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                  <Link
                    to="/admin/feedback"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 hover:from-emerald-100 dark:hover:from-emerald-900/30 transition-all duration-200 border-2 border-emerald-200 dark:border-emerald-800 active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="truncate">Voir les avis d'amélioration</span>
                  </Link>
                </div>
              )}

              {alert.type === 'order_delivered' && alert.metadata?.orderId && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                  <Link
                    to={`/orders/delivered?orderId=${alert.metadata.orderId}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 hover:from-emerald-100 hover:to-emerald-100 dark:hover:from-emerald-900/30 dark:hover:to-emerald-900/20 transition-all duration-200 border-2 border-emerald-200 dark:border-emerald-800 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="truncate">Voir commande livrée</span>
                  </Link>
                </div>
              )}

              {alert.type === 'order_cancelled' && (
                <div className="mt-4 space-y-3">
                  {alert.metadata?.reason && (
                    <div className="p-3.5 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10 rounded-xl border-l-4 border-red-400">
                      <p className="text-xs text-red-600 dark:text-red-400 mb-1.5 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                        <XCircle className="w-3 h-3" />
                        Raison de l'annulation
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 italic leading-relaxed">"{alert.metadata.reason}"</p>
                    </div>
                  )}
                  {alert.metadata?.orderId && (
                    <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                      <Link
                        to={`/orders?status=cancelled&orderId=${alert.metadata.orderId}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-700 dark:text-red-400 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10 hover:from-red-100 hover:to-red-100 dark:hover:from-red-900/30 dark:hover:to-red-900/20 transition-all duration-200 border-2 border-red-200 dark:border-red-800 active:scale-95"
                      >
                        <XCircle className="w-4 h-4" />
                        Voir commande annulée
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Product link */}
              {alert.product && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigate(buildProductPath(alert.product));
                      if (isUnread) {
                        handleMarkRead([alert._id]);
                      }
                    }}
                    className="w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-900/10 hover:from-indigo-100 hover:to-indigo-100 dark:hover:from-indigo-900/30 dark:hover:to-indigo-900/20 transition-all duration-200 border-2 border-indigo-200 dark:border-indigo-800 group/link active:scale-95"
                  >
                    <Package className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">
                      <span className="hidden sm:inline">Voir l'annonce : </span>
                      {alert.product.title}
                    </span>
                  </button>
                  {productStatus && productStatus !== 'approved' && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Annonce actuellement « {productStatus === 'pending' ? 'En attente' : productStatus} »
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!alert.product && alert.shop && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                  <Link
                    to={buildShopPath(alert.shop)}
                    className="w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-900/10 hover:from-indigo-100 hover:to-indigo-100 dark:hover:from-indigo-900/30 dark:hover:to-indigo-900/20 transition-all duration-200 border-2 border-indigo-200 dark:border-indigo-800 group/link active:scale-95"
                  >
                    <Store className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">
                      <span className="hidden sm:inline">Voir la boutique : </span>
                      {alert.shop.shopName || alert.shop.name || 'Boutique'}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleMarkAllRead = async () => {
    if (!unreadAlerts.length || marking) return;
    setMarking(true);
    setMarkError('');
    try {
      await api.patch('/users/notifications/read');
      updateCounts((prev) => ({
        ...prev,
        alerts: (prev.alerts || []).map((a) => ({ ...a, isNew: false })),
        unreadCount: 0,
        commentAlerts: 0
      }));
      triggerNotificationsRefresh();
    } catch (e) {
      console.error(e);
      setMarkError(e.response?.data?.message || e.message || 'Impossible de marquer les notifications comme lues.');
    } finally {
      setMarking(false);
    }
  };

  const handleMarkRead = async (notificationIds) => {
    if (!Array.isArray(notificationIds) || !notificationIds.length) return;
    try {
      await api.patch('/users/notifications/read', { notificationIds });
      const idsSet = new Set(notificationIds);
      updateCounts((prev) => {
        const alerts = (prev.alerts || []).map((a) =>
          idsSet.has(a._id) ? { ...a, isNew: false } : a
        );
        const markedCount = (prev.alerts || []).filter((a) => idsSet.has(a._id) && a.isNew).length;
        return {
          ...prev,
          alerts,
          unreadCount: Math.max(0, (prev.unreadCount || 0) - markedCount),
          commentAlerts: Math.max(0, (prev.commentAlerts || 0) - markedCount)
        };
      });
      triggerNotificationsRefresh();
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/users/notifications/${notificationId}`);
      updateCounts((prev) => {
        const deleted = (prev.alerts || []).find((a) => a._id === notificationId);
        const wasUnread = deleted?.isNew === true;
        return {
          ...prev,
          alerts: (prev.alerts || []).filter((a) => a._id !== notificationId),
          unreadCount: wasUnread ? Math.max(0, (prev.unreadCount || 0) - 1) : prev.unreadCount,
          commentAlerts: wasUnread ? Math.max(0, (prev.commentAlerts || 0) - 1) : prev.commentAlerts
        };
      });
      triggerNotificationsRefresh();
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const filterOptions = [
    { key: 'all', label: 'Toutes', count: alerts.length, icon: Bell },
    { key: 'unread', label: 'Non lues', count: unreadAlerts.length, icon: BellRing },
    { key: 'product_comment', label: 'Commentaires', count: alerts.filter(a => a.type === 'product_comment').length, icon: MessageSquare },
    { key: 'reply', label: 'Réponses', count: alerts.filter(a => a.type === 'reply').length, icon: MessageSquare },
    { key: 'favorite', label: 'Favoris', count: alerts.filter(a => a.type === 'favorite').length, icon: Heart },
    { key: 'rating', label: 'Notes', count: alerts.filter(a => a.type === 'rating').length, icon: Star },
    { key: 'product_approval', label: 'Approbations', count: alerts.filter(a => a.type === 'product_approval').length, icon: CheckCircle2 },
    { key: 'product_rejection', label: 'Rejets', count: alerts.filter(a => a.type === 'product_rejection').length, icon: XCircle },
    { key: 'promotional', label: 'Promotions', count: alerts.filter(a => a.type === 'promotional').length, icon: Tag },
    { key: 'shop_review', label: 'Avis boutique', count: alerts.filter(a => a.type === 'shop_review').length, icon: Store },
    { key: 'payment_pending', label: 'Paiements', count: alerts.filter(a => a.type === 'payment_pending').length, icon: CreditCard },
    { key: 'order_created', label: 'Commandes confirmées', count: alerts.filter(a => a.type === 'order_created').length, icon: ShoppingBag },
    { key: 'order_delivering', label: 'En livraison', count: alerts.filter(a => a.type === 'order_delivering').length, icon: Truck },
    { key: 'order_received', label: 'Nouvelles commandes', count: alerts.filter(a => a.type === 'order_received').length, icon: Package },
    { key: 'order_reminder', label: 'Relances', count: alerts.filter(a => a.type === 'order_reminder').length, icon: Timer },
    { key: 'order_delivered', label: 'Livrées', count: alerts.filter(a => a.type === 'order_delivered').length, icon: CheckCircle2 },
    { key: 'order_cancelled', label: 'Annulées', count: alerts.filter(a => a.type === 'order_cancelled').length, icon: XCircle },
    { key: 'feedback_read', label: 'Avis lus', count: alerts.filter(a => a.type === 'feedback_read').length, icon: Check },
    { key: 'complaint_created', label: 'Réclamations', count: alerts.filter(a => a.type === 'complaint_created').length, icon: AlertCircle },
    { key: 'improvement_feedback_created', label: 'Avis d\'amélioration', count: alerts.filter(a => a.type === 'improvement_feedback_created').length, icon: MessageSquare },
    { key: 'admin_broadcast', label: 'Messages équipe', count: alerts.filter(a => a.type === 'admin_broadcast').length, icon: Bell },
    { key: 'account_restriction', label: 'Restrictions', count: alerts.filter(a => a.type === 'account_restriction').length, icon: AlertCircle },
    { key: 'account_restriction_lifted', label: 'Restrictions levées', count: alerts.filter(a => a.type === 'account_restriction_lifted').length, icon: CheckCircle2 },
    { key: 'shop_conversion_approved', label: 'Boutique acceptée', count: alerts.filter(a => a.type === 'shop_conversion_approved').length, icon: CheckCircle2 },
    { key: 'shop_conversion_rejected', label: 'Boutique refusée', count: alerts.filter(a => a.type === 'shop_conversion_rejected').length, icon: XCircle }
  ];

  const renderFilterButtons = ({ variant = 'stack', closeOnSelect = false } = {}) =>
    filterOptions.map(({ key, label, count, icon: Icon }) => {
      const isActive = activeFilter === key;
      const isPill = variant === 'pills';
      const baseClasses = isPill
        ? `flex-shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 px-3.5 py-2 text-sm font-bold transition-all duration-200 active:scale-95 ${
            isActive
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-lg'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
          }`
        : `w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
            isActive
              ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-300 dark:border-indigo-700 shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
          }`;
      const badgeClasses = isPill
        ? `text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`
        : `px-2 py-0.5 rounded-full text-xs font-bold ${
            isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`;

      return (
        <button
          key={`${variant}-${key}`}
          onClick={() => {
            setActiveFilter(key);
            if (closeOnSelect) {
              setMobileFiltersOpen(false);
            }
          }}
          className={baseClasses}
        >
          <span className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" />}
            {label}
          </span>
          <span className={badgeClasses}>{count}</span>
        </button>
      );
    });

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="text-center py-16 sm:py-20">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">Connectez-vous</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            Connectez-vous à votre compte pour consulter vos notifications et rester informé des dernières activités.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2f2f7] dark:bg-black">
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-0 pb-8' : 'px-4 py-6 sm:px-6 lg:px-8'} space-y-6`}>
        {/* Apple-style mobile header */}
        {isMobile && (
          <header className="sticky top-0 z-10 bg-[#f2f2f7]/95 dark:bg-black/95 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800 safe-area-top">
            <div className="px-4 pt-4 pb-3">
              <h1 className="text-[34px] font-bold text-gray-900 dark:text-white tracking-tight">
                Notifications
              </h1>
              <p className="text-[15px] text-gray-500 dark:text-gray-400 mt-0.5">
                {unreadAlerts.length > 0
                  ? `${unreadAlerts.length} non lue${unreadAlerts.length > 1 ? 's' : ''}`
                  : `${alerts.length} notification${alerts.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            {/* Segmented control: Toutes | Non lues */}
            <div className="px-4 pb-3">
              <div className="inline-flex p-1 rounded-[10px] bg-gray-200 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`min-h-[36px] min-w-[80px] px-4 rounded-[8px] text-[13px] font-semibold transition-all ${
                    activeFilter === 'all'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Toutes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('unread')}
                  className={`min-h-[36px] min-w-[80px] px-4 rounded-[8px] text-[13px] font-semibold transition-all ${
                    activeFilter === 'unread'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Non lues
                </button>
              </div>
            </div>
            {/* Actions row */}
            <div className="flex items-center justify-between px-4 pb-3 gap-2">
              <NotificationPreferences preferences={preferences} onUpdate={setPreferences} />
              {unreadAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={marking}
                  className="text-[15px] font-semibold text-blue-600 dark:text-blue-400 active:opacity-70 disabled:opacity-50"
                >
                  {marking ? '...' : 'Tout marquer lu'}
                </button>
              )}
            </div>
          </header>
        )}

        {/* Desktop header */}
        {!isMobile && (
          <header className="bg-gradient-to-br from-white via-white to-indigo-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-900/20 rounded-3xl p-6 sm:p-8 border-2 border-gray-200/60 dark:border-gray-700/50 shadow-xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-indigo-100 dark:ring-indigo-900/30">
                    <Bell className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
                      Notifications
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {unreadAlerts.length > 0
                        ? `${unreadAlerts.length} nouvelle${unreadAlerts.length > 1 ? 's' : ''} notification${unreadAlerts.length > 1 ? 's' : ''}`
                        : 'Toutes vos notifications sont à jour'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <NotificationPreferences preferences={preferences} onUpdate={setPreferences} />
                {unreadAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={marking}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-bold text-white transition-all hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
                  >
                    {marking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Traitement...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Tout marquer comme lu</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        {/* Mobile filters (Apple: grouped list style) */}
        {isMobile && (
          <div className="px-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl bg-white dark:bg-gray-800 text-[17px] font-medium text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-gray-700"
            >
              <span className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                Filtres
              </span>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${mobileFiltersOpen ? 'rotate-90' : ''}`} />
            </button>
            {mobileFiltersOpen && (
              <div className="mt-2 p-4 rounded-xl bg-white dark:bg-gray-800 space-y-1">
                {renderFilterButtons({ variant: 'stack', closeOnSelect: true })}
              </div>
            )}
          </div>
        )}

        {/* Desktop: Mobile filters & stats (original) - only when not isMobile for the old mobile breakpoint */}
        <div className="space-y-4 lg:hidden hidden sm:block">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 opacity-90" />
                <p className="text-xs uppercase tracking-wide text-white/80 font-bold">Total</p>
              </div>
              <p className="text-4xl font-black">{alerts.length}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-5 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <p className="text-xs uppercase tracking-wide text-white/80 font-bold">Non lues</p>
              </div>
              <p className="text-4xl font-black">{unreadAlerts.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Filtres</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95"
              >
                {mobileFiltersOpen ? 'Masquer' : 'Voir tout'}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileFiltersOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {renderFilterButtons({ variant: 'pills' })}
            </div>
            {mobileFiltersOpen && (
              <div className="mt-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700 space-y-1.5">
                {renderFilterButtons({ variant: 'stack', closeOnSelect: true })}
              </div>
            )}
          </div>
        </div>

        {/* Stats & Filters */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Quick Stats */}
              <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ring-2 ring-white/30">
                    <BellRing className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xl">Aperçu</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                    <span className="text-white/90 font-semibold">Total</span>
                    <span className="font-black text-2xl">{alerts.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                    <span className="text-white/90 font-semibold">Non lues</span>
                    <span className="font-black text-2xl bg-white/30 backdrop-blur-sm px-3 py-1 rounded-lg">
                      {unreadAlerts.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filter Options */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Filtrer par</h3>
                </div>
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                  {renderFilterButtons()}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 min-w-0">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                  <span className="text-gray-600 dark:text-gray-400 font-semibold">Chargement des notifications...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10 border-2 border-red-300 dark:border-red-800 rounded-3xl p-8 text-center shadow-xl">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-red-700 dark:text-red-400 font-bold text-lg mb-2">Erreur de chargement</p>
                <p className="text-red-600 dark:text-red-500 text-sm">{error}</p>
              </div>
            )}

            {markError && (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-red-700 dark:text-red-400 text-sm font-medium">{markError}</p>
                </div>
              </div>
            )}

            {/* Unread Notifications */}
            {unreadAlerts.length > 0 && (activeFilter === 'all' || activeFilter === 'unread') && (
              <section className={isMobile ? 'mb-4' : 'space-y-4 mb-8'}>
                {!isMobile && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1.5 h-10 bg-gradient-to-b from-indigo-600 to-purple-600 rounded-full shadow-lg" />
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">Non lues</h2>
                    <span className="bg-gradient-to-r from-red-600 to-pink-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg ring-2 ring-red-100 dark:ring-red-900/30">
                      {unreadAlerts.length}
                    </span>
                  </div>
                )}
                <div className={isMobile ? 'rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm' : 'space-y-4'}>
                  {unreadAlerts.map((alert) => renderAlert(alert, true, isMobile))}
                </div>
              </section>
            )}

            {/* Read Notifications */}
            {readAlerts.length > 0 && (activeFilter === 'all' || activeFilter !== 'unread') && (
              <section className={isMobile ? '' : 'space-y-4'}>
                {!isMobile && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1.5 h-10 bg-gray-400 rounded-full" />
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                      {activeFilter === 'all' ? 'Notifications lues' : 'Notifications'}
                    </h2>
                  </div>
                )}
                <div className={isMobile && unreadAlerts.length > 0 ? 'mt-4 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm' : isMobile ? 'rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm' : 'space-y-4'}>
                  {readAlerts.map((alert) => renderAlert(alert, false, isMobile))}
                </div>
              </section>
            )}

            {/* Empty States */}
            {!loading && !error && filteredAlerts.length === 0 && (
              <div className="text-center py-20">
                <div className="w-28 h-28 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Archive className="w-14 h-14 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-3">
                  {activeFilter === 'all' ? 'Aucune notification' : 'Aucune notification correspondante'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                  {activeFilter === 'all'
                    ? 'Les notifications concernant vos annonces et commentaires apparaîtront ici.'
                    : 'Aucune notification ne correspond aux filtres sélectionnés.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
