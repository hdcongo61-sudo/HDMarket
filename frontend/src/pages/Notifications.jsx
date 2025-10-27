import React, { useContext, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import useUserNotifications, { triggerNotificationsRefresh } from '../hooks/useUserNotifications';
import api from '../services/api';

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

export default function Notifications() {
  const { user } = useContext(AuthContext);
  const { counts, loading, error, refresh } = useUserNotifications(Boolean(user));
  const alerts = counts.alerts || [];
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');

  const unreadAlerts = useMemo(() => alerts.filter((alert) => alert.isNew), [alerts]);
  const readAlerts = useMemo(() => alerts.filter((alert) => !alert.isNew), [alerts]);

  const renderAlert = (alert, isUnread) => (
    <li
      key={alert._id}
      className={`border rounded-lg p-4 shadow-sm space-y-2 ${
        isUnread ? 'bg-white border-indigo-200 ring-1 ring-indigo-100' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 text-xs">
        {isUnread && (
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Non lu" />
        )}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
            alert.type === 'reply' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {alert.type === 'reply' ? 'Réponse' : 'Commentaire'}
        </span>
        <span className="text-gray-500">{formatDateTime(alert.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span />
        {alert.user?.name && <span className="font-medium text-gray-700">{alert.user.name}</span>}
      </div>
      {alert.type === 'reply' && alert.parent?.message && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2">
          Votre commentaire : {alert.parent.message}
        </div>
      )}
      <div className="text-sm text-gray-800 whitespace-pre-line">{alert.message}</div>
      {alert.product && (
        <Link
          to={`/product/${alert.product._id}`}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          Voir l'annonce : {alert.product.title}
        </Link>
      )}
    </li>
  );

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

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-4">
        <p className="text-sm text-gray-500">Connectez-vous pour consulter vos notifications.</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500">Suivez les derniers commentaires laissés sur vos annonces.</p>
      </header>

      {loading && <p className="text-sm text-gray-500">Chargement des notifications…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {markError && <p className="text-sm text-red-600">{markError}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Notifications non lues</h2>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={!unreadAlerts.length || marking}
            className="inline-flex items-center gap-2 rounded border border-indigo-200 px-3 py-1 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-60"
          >
            Tout marquer comme lu
          </button>
        </div>
        {unreadAlerts.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-500 bg-white shadow-sm">
            Aucune notification non lue pour le moment.
          </div>
        ) : (
          <ul className="space-y-3">
            {unreadAlerts.map((alert) => renderAlert(alert, true))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Notifications lues</h2>
        {readAlerts.length === 0 ? (
          <div className="border rounded p-4 text-sm text-gray-500 bg-gray-50 shadow-sm">
            Les notifications lues apparaîtront ici après avoir été consultées.
          </div>
        ) : (
          <ul className="space-y-3">
            {readAlerts.map((alert) => renderAlert(alert, false))}
          </ul>
        )}
      </section>
    </main>
  );
}
