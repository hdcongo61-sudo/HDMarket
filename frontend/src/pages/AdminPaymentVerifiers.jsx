import React, { useCallback, useEffect, useState } from 'react';
import { Search, UserPlus, UserMinus, DollarSign } from 'lucide-react';
import api from '../services/api';

export default function AdminPaymentVerifiers() {
  const [verifiers, setVerifiers] = useState([]);
  const [loadingVerifiers, setLoadingVerifiers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [foundUsers, setFoundUsers] = useState([]);

  const loadVerifiers = useCallback(async () => {
    setLoadingVerifiers(true);
    try {
      const { data } = await api.get('/admin/payment-verifiers');
      setVerifiers(data.verifiers || []);
    } catch (err) {
      console.error('Load verifiers error:', err);
    } finally {
      setLoadingVerifiers(false);
    }
  }, []);

  useEffect(() => {
    loadVerifiers();
  }, [loadVerifiers]);

  const handleToggleVerifier = async (userId) => {
    if (!userId || typeof userId !== 'string') {
      alert('ID utilisateur invalide');
      return;
    }

    if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
      alert(`Format d'ID invalide: ${userId}`);
      return;
    }

    try {
      const { data } = await api.patch(`/admin/payment-verifiers/${userId}/toggle`);
      alert(data.message || 'Statut mis à jour');
      await loadVerifiers();
      setFoundUsers([]);
      setUserSearchQuery('');
    } catch (err) {
      console.error('Toggle verifier error:', err);
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim()) return;
    setSearchingUsers(true);
    try {
      const { data } = await api.get(`/admin/users?search=${encodeURIComponent(userSearchQuery.trim())}&limit=10`);
      const users = Array.isArray(data) ? data.filter(u => u.role !== 'admin') : [];
      setFoundUsers(users);
    } catch (err) {
      console.error('Search users error:', err);
      setFoundUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Vérificateurs de paiements
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez les utilisateurs autorisés à vérifier les paiements
          </p>
        </header>

        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 space-y-6">
          {/* Search users */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ajouter un vérificateur</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rechercher un utilisateur (nom, email, téléphone)..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                onClick={handleSearchUsers}
                disabled={searchingUsers || !userSearchQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Search results */}
            {foundUsers.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Résultats de recherche:</p>
                {foundUsers.map((user) => (
                  <div
                    key={user._id || user.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email} · {user.phone}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleVerifier(user._id || user.id)}
                      className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Ajouter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current verifiers */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold mb-3">
              Vérificateurs actuels ({verifiers.length}):
            </p>
            {loadingVerifiers ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>
            ) : verifiers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucun vérificateur de paiements pour le moment.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {verifiers.map((verifier) => (
                  <div
                    key={verifier.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {verifier.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {verifier.email} · {verifier.phone}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleVerifier(verifier.id)}
                      className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 active:scale-95 transition-all"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
