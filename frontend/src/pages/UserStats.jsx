import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  CheckCircle,
  Heart,
  MessageCircle,
  TrendingUp,
  BarChart3,
  Store,
  Star,
  Sparkles
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';

const numberFormatter = new Intl.NumberFormat('fr-FR');
const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '0';
  return numberFormatter.format(parsed);
};
const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const DEFAULT_STATS = {
  listings: { total: 0, approved: 0, pending: 0, rejected: 0, disabled: 0 },
  engagement: { favoritesReceived: 0, commentsReceived: 0, favoritesSaved: 0 },
  performance: { views: 0, clicks: 0, conversion: 0 },
  breakdown: { categories: [], conditions: [] },
  timeline: [],
  topProducts: [],
  advertismentSpend: 0
};

const SummaryCard = ({ icon: Icon, label, value, accent }) => (
  <div className={`rounded-2xl p-5 text-white bg-gradient-to-br ${accent} shadow-lg`}>
    <div className="flex items-center justify-between mb-3">
      <div className="rounded-xl bg-white/20 p-2">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold">{formatNumber(value)}</span>
    </div>
    <p className="text-sm text-white/90 font-medium">{label}</p>
  </div>
);

export default function UserStats() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userShopLink = user?.accountType === 'shop' ? `/shop/${user?._id || user?.id}` : null;

  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/users/profile/stats');
        if (!active) return;
        setStats((prev) => ({
          ...DEFAULT_STATS,
          ...data,
          listings: { ...DEFAULT_STATS.listings, ...(data?.listings || {}) },
          engagement: { ...DEFAULT_STATS.engagement, ...(data?.engagement || {}) },
          performance: { ...DEFAULT_STATS.performance, ...(data?.performance || {}) },
          breakdown: {
            categories: data?.breakdown?.categories || [],
            conditions: data?.breakdown?.conditions || []
          },
          timeline: data?.timeline || [],
          topProducts: data?.topProducts || [],
          advertismentSpend: data?.advertismentSpend ?? prev.advertismentSpend ?? 0
        }));
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || err.message || 'Impossible de charger les statistiques.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchStats();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const categoryMax = useMemo(() => {
    return stats.breakdown.categories.reduce((max, item) => Math.max(max, item.count || 0), 0) || 1;
  }, [stats.breakdown.categories]);

  const timeline = useMemo(() => stats.timeline || [], [stats.timeline]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Connectez-vous pour voir vos statistiques</h1>
        <p className="text-gray-600 mb-6">Vos performances et insights personnalisés sont accessibles après authentification.</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">Analyse</p>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques de votre activité</h1>
          <p className="text-gray-600 text-sm">
            Suivez les performances de votre boutique et l'impact de vos publications.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Link
            to="/my"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Package className="w-4 h-4" />
            Mes annonces
          </Link>
          {userShopLink && (
            <Link
              to={userShopLink}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Store className="w-4 h-4" />
              Ma boutique publique
            </Link>
          )}
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Store className="w-4 h-4" />
            Mon profil
          </Link>
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Budget annonces : {formatCurrency(stats.advertismentSpend)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="mx-auto h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 mt-4">Chargement des statistiques…</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Impossible de charger les données</h2>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Résumé */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Package} label="Annonces totales" value={stats.listings.total} accent="from-indigo-500 to-blue-600" />
            <SummaryCard icon={CheckCircle} label="Approuvées" value={stats.listings.approved} accent="from-emerald-500 to-green-600" />
            <SummaryCard icon={Heart} label="Favoris reçus" value={stats.engagement.favoritesReceived} accent="from-pink-500 to-rose-600" />
            <SummaryCard icon={MessageCircle} label="Contacts WhatsApp" value={stats.performance.clicks} accent="from-purple-500 to-indigo-600" />
            <div className="rounded-2xl p-5 bg-white border border-gray-100 flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-600">Dépenses annonces</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.advertismentSpend)}</p>
              <p className="text-xs text-gray-500">Total des frais confirmés pour vos publications.</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900">Catégories les plus actives</h2>
              </div>
              {stats.breakdown.categories.length === 0 ? (
                <p className="text-sm text-gray-500">Publiez des annonces pour voir vos catégories performantes.</p>
              ) : (
                <div className="space-y-3">
                  {stats.breakdown.categories.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="capitalize">{cat.category}</span>
                        <span className="font-semibold text-gray-900">{formatNumber(cat.count)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          style={{ width: `${(cat.count / categoryMax) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Performance globale</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                  <p className="text-xs uppercase text-green-800 font-semibold">Conversion estimée</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{stats.performance.conversion}%</p>
                  <p className="text-xs text-green-600 mt-1">Basé sur vos annonces approuvées</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs uppercase text-blue-800 font-semibold">Commentaires reçus</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{formatNumber(stats.engagement.commentsReceived)}</p>
                  <p className="text-xs text-blue-600 mt-1">Interactions clients</p>
                </div>
                <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
                  <p className="text-xs uppercase text-purple-800 font-semibold">Favoris sauvegardés</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">{formatNumber(stats.engagement.favoritesSaved)}</p>
                  <p className="text-xs text-purple-600 mt-1">Dans votre liste personnelle</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs uppercase text-amber-800 font-semibold">Statut des annonces</p>
                  <p className="text-sm text-amber-700 mt-1">
                    {formatNumber(stats.listings.pending)} en attente • {formatNumber(stats.listings.rejected)} rejetées
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Pensez à suivre vos dossiers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-pink-500" />
              <h2 className="text-lg font-semibold text-gray-900">Publications récentes</h2>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500">Publiez vos premières annonces pour voir l'activité mensuelle.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {timeline.map((item) => (
                  <div key={`${item.year}-${item.month}`} className="rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-xs uppercase text-gray-500">{item.label}</p>
                    <p className="text-xl font-bold text-gray-900">{formatNumber(item.count)}</p>
                    <p className="text-[11px] text-gray-500">{formatNumber(item.favorites)} favoris • {formatNumber(item.clicks)} clics</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top products */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Meilleures annonces</h2>
            </div>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-gray-500">Dès que vos annonces reçoivent des interactions, elles apparaîtront ici.</p>
            ) : (
              <div className="space-y-4">
                {stats.topProducts.map((product) => (
                  <div
                    key={product._id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={product.image || '/api/placeholder/80/80'}
                        alt={product.title}
                        className="w-16 h-16 rounded-xl object-cover border"
                      />
                      <div className="space-y-1">
                        <Link
                          to={`/product/${product._id}`}
                          className="font-semibold text-gray-900 hover:text-indigo-600"
                        >
                          {product.title}
                        </Link>
                        <p className="text-sm text-gray-500 capitalize">{product.category || 'Sans catégorie'}</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {Number(product.price || 0).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1"><Heart className="w-4 h-4 text-pink-500" /> {formatNumber(product.favorites)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-4 h-4 text-green-500" /> {formatNumber(product.whatsappClicks)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
