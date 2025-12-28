import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import useUserNotifications, { triggerNotificationsRefresh } from '../hooks/useUserNotifications';
import api from '../services/api';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  product_comment: true,
  reply: true,
  favorite: true,
  rating: true,
  product_approval: true,
  product_rejection: true,
  promotional: true,
  shop_review: true,
  payment_pending: true,
  order_created: true,
  order_delivered: true
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

// New: Notification preferences component
const NotificationPreferences = ({ preferences, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
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
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Préférences
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-10 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Préférences de notification</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {[
              { key: 'product_comment', label: 'Nouveaux commentaires' },
              { key: 'reply', label: 'Réponses à mes commentaires' },
              { key: 'favorite', label: 'Ajouts aux favoris' },
              { key: 'rating', label: 'Nouvelles notes' },
              { key: 'product_approval', label: "Approbations d'annonce" },
              { key: 'product_rejection', label: "Rejets d'annonce" },
              { key: 'promotional', label: 'Promotions appliquées' },
              { key: 'shop_review', label: 'Avis sur ma boutique' },
              { key: 'payment_pending', label: 'Paiements à valider' },
              { key: 'order_created', label: 'Commandes confirmées' },
              { key: 'order_delivered', label: 'Commandes livrées' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{label}</span>
                <button
                  onClick={() => handleToggle(key)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences[key] ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences[key] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { counts, loading, error, refresh } = useUserNotifications(Boolean(user));
  const alerts = counts.alerts || [];
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [preferences, setPreferences] = useState(() => ({ ...DEFAULT_NOTIFICATION_PREFERENCES }));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    reply: { 
      label: 'Réponse', 
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      )
    },
    favorite: { 
      label: 'Favori', 
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )
    },
    rating: { 
      label: 'Note', 
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    },
    product_approval: {
      label: 'Approbation',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    product_rejection: {
      label: 'Rejet',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    },
    promotional: {
      label: 'Promotion',
      badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M4 4v5a2 2 0 002 2h5l9 9V13a2 2 0 00-2-2h-5L4 4z" />
        </svg>
      )
    },
    shop_review: {
      label: 'Avis boutique',
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l1.664 8.319A2 2 0 006.632 17h10.736a2 2 0 001.968-1.681L21 7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" />
        </svg>
      )
    },
    payment_pending: {
      label: 'Paiement en attente',
      badgeClass: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 21h6a2 2 0 002-2v-3a2 2 0 00-2-2H9m6 0l-2-2m0 0l-2 2m2-2v6" />
        </svg>
      )
    },
    order_created: {
      label: 'Commande confirmée',
      badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 7l1.5 12.5A2 2 0 006.5 21h11a2 2 0 002-1.5L21 7M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3" />
        </svg>
      )
    },
    order_delivered: {
      label: 'Commande livrée',
      badgeClass: 'bg-green-50 text-green-700 border border-green-200',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2l4-5V4H9m0 13h6m-6 0v2a2 2 0 002 2h2a2 2 0 002-2v-2m-6 0H5a2 2 0 01-2-2V7m16 0h1a2 2 0 012 2v6a2 2 0 01-2 2h-1" />
        </svg>
      )
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

  const renderAlert = (alert, isUnread) => {
    const productStatus = alert.product?.status;
    const config = typeConfig[alert.type] || {
      label: 'Notification',
      badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200',
      icon: null
    };

    return (
      <div
        key={alert._id}
        className={`group relative p-6 rounded-2xl transition-all duration-200 ${
          isUnread 
            ? 'bg-white border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md' 
            : 'bg-gray-50/50 border-l-4 border-l-gray-200 hover:bg-white'
        }`}
      >
        {/* Unread indicator */}
        {isUnread && (
          <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
          </div>
        )}

        <div className="flex gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isUnread ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.badgeClass}`}>
                  {config.icon}
                  {config.label}
                </span>
                <span className="text-xs text-gray-500">{formatDateTime(alert.createdAt)}</span>
                {isUnread && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                    <svg className="w-2 h-2 fill-current" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4" />
                    </svg>
                    Nouveau
                  </span>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isUnread && (
                  <button
                    onClick={() => handleMarkRead([alert._id])}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Marquer comme lu"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDeleteNotification(alert._id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* User info */}
            {alert.user?.name && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {alert.user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-900">{alert.user.name}</span>
              </div>
            )}

            {/* Parent message for replies */}
            {alert.type === 'reply' && alert.parent?.message && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 mb-1 font-medium">Votre commentaire :</p>
                <p className="text-sm text-gray-700 italic">"{alert.parent.message}"</p>
              </div>
            )}

            {/* Main message */}
            <p className="text-gray-800 leading-relaxed mb-3">{alert.message}</p>

            {alert.type === 'shop_review' && alert.metadata?.rating && (
              <div className="flex items-center gap-2 text-sm text-amber-600 font-semibold mb-2">
                <Star size={14} className="text-amber-500" />
                <span>Note : {Number(alert.metadata.rating).toFixed(1)}/5</span>
              </div>
            )}

            {alert.type === 'shop_review' && alert.metadata?.comment && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 mb-3 text-sm text-gray-700 italic">
                "{alert.metadata.comment}"
              </div>
            )}

            {alert.type === 'payment_pending' && (user?.role === 'admin' || user?.role === 'manager') && (
              <div className="mt-2">
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Accéder à la vérification des paiements
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}

            {/* Product link */}
            {alert.product && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/product/${alert.product._id}`);
                    if (isUnread) {
                      handleMarkRead([alert._id]);
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors group/link"
                >
                  <svg className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Voir l'annonce : {alert.product.title}
                </button>
                {productStatus && productStatus !== 'approved' && (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Annonce actuellement « {productStatus === 'pending' ? 'En attente' : productStatus} ».
                  </p>
                )}
              </div>
            )}

            {!alert.product && alert.shop && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <Link
                  to={`/shop/${alert.shop._id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors group/link"
                >
                  <svg className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 7l1.664 8.319A2 2 0 007.632 17h8.736a2 2 0 001.968-1.681L20 7M9 21h6" />
                  </svg>
                  Voir la boutique : {alert.shop.shopName || alert.shop.name || 'Boutique'}
                </Link>
              </div>
            )}
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
      triggerNotificationsRefresh();
      await refresh();
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
      triggerNotificationsRefresh();
      await refresh();
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.delete(`/users/notifications/${notificationId}`);
      triggerNotificationsRefresh();
      await refresh();
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const filterOptions = [
    { key: 'all', label: 'Toutes', count: alerts.length },
    { key: 'unread', label: 'Non lues', count: unreadAlerts.length },
    { key: 'product_comment', label: 'Commentaires', count: alerts.filter(a => a.type === 'product_comment').length },
    { key: 'reply', label: 'Réponses', count: alerts.filter(a => a.type === 'reply').length },
    { key: 'favorite', label: 'Favoris', count: alerts.filter(a => a.type === 'favorite').length },
    { key: 'rating', label: 'Notes', count: alerts.filter(a => a.type === 'rating').length },
    { key: 'product_approval', label: 'Approbations', count: alerts.filter(a => a.type === 'product_approval').length },
    { key: 'product_rejection', label: 'Rejets', count: alerts.filter(a => a.type === 'product_rejection').length },
    { key: 'promotional', label: 'Promotions', count: alerts.filter(a => a.type === 'promotional').length },
    { key: 'shop_review', label: 'Avis boutique', count: alerts.filter(a => a.type === 'shop_review').length },
    { key: 'payment_pending', label: 'Paiements à valider', count: alerts.filter(a => a.type === 'payment_pending').length },
    { key: 'order_created', label: 'Commandes confirmées', count: alerts.filter(a => a.type === 'order_created').length },
    { key: 'order_delivered', label: 'Commandes livrées', count: alerts.filter(a => a.type === 'order_delivered').length }
  ];

  const renderFilterButtons = ({ variant = 'stack', closeOnSelect = false } = {}) =>
    filterOptions.map(({ key, label, count }) => {
      const isActive = activeFilter === key;
      const isPill = variant === 'pills';
      const baseClasses = isPill
        ? `flex-shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors ${
            isActive
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-gray-200 text-gray-600'
          }`
        : `w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
            isActive
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`;
      const badgeClasses = isPill
        ? `text-xs font-semibold ${isActive ? 'text-white/90' : 'text-gray-500'}`
        : `px-2 py-1 rounded-full text-xs ${
            isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
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
          <span>{label}</span>
          <span className={badgeClasses}>{count}</span>
        </button>
      );
    });

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connectez-vous</h2>
          <p className="text-gray-600 max-w-sm mx-auto">
            Connectez-vous à votre compte pour consulter vos notifications et rester informé des dernières activités.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Suivez les dernières interactions sur vos annonces et commentaires
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="hidden sm:flex items-center justify-start gap-3">
            <NotificationPreferences preferences={preferences} onUpdate={setPreferences} />
          </div>
          
          {unreadAlerts.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={marking}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {marking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tout marquer comme lu
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Mobile filters & stats */}
      <div className="space-y-4 lg:hidden">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-100">Total</p>
            <p className="text-2xl font-semibold">{alerts.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-100">Non lues</p>
            <p className="inline-flex items-center gap-2 text-2xl font-semibold">
              {unreadAlerts.length}
              {Boolean(unreadAlerts.length) && (
                <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">New</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Filtres rapides</h3>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-gray-500"
            >
              {mobileFiltersOpen ? 'Masquer' : 'Plus'}
              <svg
                className={`w-4 h-4 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {renderFilterButtons({ variant: 'pills' })}
          </div>

          {mobileFiltersOpen && (
            <div className="space-y-1">
              {renderFilterButtons({ variant: 'stack', closeOnSelect: true })}
            </div>
          )}
        </div>
      </div>

      {/* Stats & Filters */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters */}
        <div className="hidden lg:block lg:w-64 flex-shrink-0">
          <div className="sticky top-6 space-y-6">
            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
              <h3 className="font-semibold mb-3">Aperçu</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Total</span>
                  <span className="font-semibold">{alerts.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100">Non lues</span>
                  <span className="font-semibold bg-white/20 px-2 py-1 rounded-full text-xs">
                    {unreadAlerts.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Options */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Filtrer par</h3>
              <div className="space-y-1">
                {renderFilterButtons()}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Chargement des notifications...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-700 font-medium mb-2">Erreur de chargement</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {markError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 text-sm">{markError}</p>
            </div>
          )}

          {/* Unread Notifications */}
          {unreadAlerts.length > 0 && (activeFilter === 'all' || activeFilter === 'unread') && (
            <section className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">Non lues</h2>
                <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                  {unreadAlerts.length}
                </span>
              </div>
              <div className="space-y-3">
                {unreadAlerts.map((alert) => renderAlert(alert, true))}
              </div>
            </section>
          )}

          {/* Read Notifications */}
          {readAlerts.length > 0 && (activeFilter === 'all' || activeFilter !== 'unread') && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {activeFilter === 'all' ? 'Notifications lues' : 'Notifications'}
              </h2>
              <div className="space-y-3">
                {readAlerts.map((alert) => renderAlert(alert, false))}
              </div>
            </section>
          )}

          {/* Empty States */}
          {!loading && !error && filteredAlerts.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {activeFilter === 'all' ? 'Aucune notification' : 'Aucune notification correspondante'}
              </h3>
              <p className="text-gray-600 max-w-sm mx-auto">
                {activeFilter === 'all' 
                  ? 'Les notifications concernant vos annonces et commentaires apparaîtront ici.'
                  : 'Aucune notification ne correspond aux filtres sélectionnés.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
