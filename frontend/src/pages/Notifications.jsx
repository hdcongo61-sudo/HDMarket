import React, { useContext, useEffect } from 'react';
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

  useEffect(() => {
    if (!user) return;
    const markRead = async () => {
      try {
        await api.patch('/users/notifications/read');
        triggerNotificationsRefresh();
        await refresh();
      } catch (e) {
        // Silent fail; errors already surfaced via hook when fetching
        console.error(e);
      }
    };
    markRead();
  }, [user, refresh]);

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

      {alerts.length === 0 ? (
        <div className="border rounded p-6 text-center text-sm text-gray-500 bg-white shadow-sm">
          Aucun nouveau commentaire pour le moment.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert._id} className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs">
                {alert.isNew && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-red-500" aria-label="Nouveau" />
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${
                    alert.type === 'reply'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
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
          ))}
        </ul>
      )}
    </main>
  );
}
