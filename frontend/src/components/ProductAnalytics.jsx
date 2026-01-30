import React, { useEffect, useState } from 'react';
import { Eye, Heart, MessageCircle, ShoppingCart, TrendingUp, X, BarChart3 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ProductAnalytics({ productId, productTitle, onClose }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (productId) {
      loadAnalytics();
    }
  }, [productId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/products/${productId}/analytics`);
      setAnalytics(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des analytics');
      showToast('Erreur lors du chargement des analytics', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!productId) return null;

  const metrics = analytics?.metrics || {};
  const viewsOverTime = analytics?.viewsOverTime || [];

  // Calculate max views for chart scaling
  const maxViews = Math.max(...viewsOverTime.map((v) => v.views), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analytics du produit</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">{productTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <>
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl p-4 border border-pink-200 dark:border-pink-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-pink-500 text-white">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide">Favoris</p>
                      <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">{metrics.favoritesCount || 0}</p>
                    </div>
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-400">Utilisateurs qui ont aimé</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500 text-white">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Clics WhatsApp</p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">{metrics.whatsappClicks || 0}</p>
                    </div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">Contacts générés</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500 text-white">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Ventes</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{metrics.salesCount || 0}</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Commandes réalisées</p>
                </div>
              </div>

              {/* Performance Chart */}
              {viewsOverTime.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vues sur les 30 derniers jours</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Total: {metrics.totalViews || 0} vues • {metrics.uniqueViewers || 0} visiteurs uniques
                      </p>
                    </div>
                  </div>
                  <div className="h-64 flex items-end gap-1">
                    {viewsOverTime.map((day, index) => {
                      const height = maxViews > 0 ? (day.views / maxViews) * 100 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center group relative">
                          <div
                            className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t transition-all cursor-pointer"
                            style={{ height: `${height}%`, minHeight: day.views > 0 ? '4px' : '0' }}
                            title={`${new Date(day.date).toLocaleDateString('fr-FR')}: ${day.views} vue(s)`}
                          />
                          {index % 5 === 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 transform -rotate-45 origin-left whitespace-nowrap">
                              {new Date(day.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conversion Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Taux de conversion</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics.totalViews > 0
                      ? ((metrics.whatsappClicks / metrics.totalViews) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vues → Contacts</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Taux d'engagement</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(metrics.totalViews || 0) > 0
                      ? (((metrics.favoritesCount || 0) / metrics.totalViews) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Vues → Favoris</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Taux de vente</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metrics.whatsappClicks > 0
                      ? ((metrics.salesCount / metrics.whatsappClicks) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contacts → Ventes</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
