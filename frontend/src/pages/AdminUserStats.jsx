import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';

const numberFormatter = new Intl.NumberFormat('fr-FR');
const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return numberFormatter.format(parsed);
};
const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const SummaryCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-2xl font-semibold text-gray-900">{value}</p>
    {helper ? <p className="text-xs text-gray-400 mt-1">{helper}</p> : null}
  </div>
);

const HighlightStat = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-indigo-600 to-blue-600 px-4 py-5 text-white shadow-lg">
    <p className="text-xs uppercase tracking-wide text-indigo-100">{label}</p>
    <p className="text-3xl font-semibold">{value}</p>
    {helper ? <p className="text-xs text-indigo-100/80 mt-1">{helper}</p> : null}
  </div>
);

const SectionModal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
        >
          Fermer
        </button>
      </div>
      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">{children}</div>
    </div>
  </div>
);

export default function AdminUserStats() {
  const { id } = useParams();
  const SHOPS_PER_PAGE = 6;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const [shopPage, setShopPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let isMounted = true;
    setLoading(true);
    setError('');

    api
      .get(`/admin/users/${id}/stats`, { signal: controller.signal })
      .then((response) => {
        if (!isMounted) return;
        setStats(response.data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err.response?.data?.message || err.message || 'Impossible de charger les statistiques.'
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);

  const timeline = useMemo(() => stats?.timeline || [], [stats]);
  const categories = useMemo(() => stats?.breakdown?.categories || [], [stats]);
  const topProducts = useMemo(() => stats?.topProducts || [], [stats]);

  const summary = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'Annonces totales',
        value: formatNumber(stats.listings.total),
        helper: `${formatNumber(stats.listings.approved)} publiées`
      },
      {
        label: 'Favoris reçus',
        value: formatNumber(stats.engagement.favoritesReceived)
      },
      {
        label: 'Commentaires reçus',
        value: formatNumber(stats.engagement.commentsReceived)
      },
      {
        label: 'Favoris enregistrés',
        value: formatNumber(stats.engagement.favoritesSaved)
      },
      {
        label: 'Boutiques suivies',
        value: formatNumber(stats.engagement.shopsFollowed)
      },
      {
        label: 'Budget annonces',
        value: formatCurrency(stats.advertismentSpend)
      }
    ];
  }, [stats]);

  const highlightStats = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'Contacts WhatsApp',
        value: formatNumber(stats.performance.clicks),
        helper: 'Nombre de clics générés'
      },
      {
        label: 'Vues totales',
        value: formatNumber(stats.performance.views),
        helper: 'Réponses aux annonces'
      },
      {
        label: 'Conversion',
        value: `${formatNumber(stats.performance.conversion)} %`,
        helper: 'Annonces approuvées'
      }
    ];
  }, [stats]);

  const openModal = (section) => setActiveModal(section);
  const closeModal = () => setActiveModal(null);

  const renderModalContent = () => {
    if (!activeModal || !stats) return null;
    switch (activeModal) {
      case 'summary':
        return (
          <dl className="space-y-3">
            {summary.map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <dt className="text-xs uppercase tracking-wide text-gray-500">{item.label}</dt>
                <dd className="text-sm font-semibold text-gray-900">{item.helper ? `${item.value} · ${item.helper}` : item.value}</dd>
              </div>
            ))}
          </dl>
        );
      case 'highlights':
        return (
          <div className="space-y-3">
            {highlightStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                <p className="text-xl font-semibold text-gray-900">{item.value}</p>
                {item.helper ? <p className="text-xs text-gray-500">{item.helper}</p> : null}
              </div>
            ))}
          </div>
        );
      case 'timeline':
        return timeline.length ? (
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div key={entry.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">{entry.label}</p>
                <p className="text-sm font-semibold text-gray-900">{formatNumber(entry.count)} annonces</p>
                <p className="text-xs text-gray-500">
                  {formatNumber(entry.favorites)} favoris · {formatNumber(entry.clicks)} contacts
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Aucune activité récente.</p>
        );
      case 'categories':
        return categories.length ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.category}
                className="rounded-full border border-gray-200 bg-white px-4 py-1 text-xs font-semibold text-gray-600"
              >
                {category.category} · {formatNumber(category.count)} annonces
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Aucune donnée catégorielle disponible.</p>
        );
      case 'topProducts':
        return topProducts.length ? (
          <div className="space-y-3">
            {topProducts.map((product) => (
              <div key={product._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{product.title}</p>
                  <span className="text-xs text-gray-500">{product.category || 'Catégorie inconnue'}</span>
                </div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{product.status || 'Statut inconnu'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 text-pink-500" />
                    {formatNumber(product.favorites)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-purple-500" />
                    {formatNumber(product.whatsappClicks)}
                  </span>
                  <span className="text-xs text-gray-400">{formatCurrency(product.price)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Aucun produit avec suffisamment d'engagement.</p>
        );
      default:
        return null;
    }
  };

  const followedShops = useMemo(() => stats?.followedShops || [], [stats]);
  const totalShopPages = Math.max(1, Math.ceil(followedShops.length / SHOPS_PER_PAGE));
  const paginatedShops = useMemo(() => {
    const start = (shopPage - 1) * SHOPS_PER_PAGE;
    return followedShops.slice(start, start + SHOPS_PER_PAGE);
  }, [followedShops, shopPage]);

  useEffect(() => {
    setShopPage((prev) => {
      const maxPage = Math.max(1, Math.ceil(followedShops.length / SHOPS_PER_PAGE));
      return Math.min(prev, maxPage);
    });
  }, [followedShops.length]);

  const modalTitleMap = {
    summary: 'Vue d’ensemble',
    highlights: 'Performances',
    timeline: 'Timeline détaillée',
    categories: 'Répartition par catégorie',
    topProducts: 'Produits les plus engagés'
  };
  const modalTitle = activeModal ? modalTitleMap[activeModal] : '';

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Chargement des statistiques…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-1 text-xs font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au back office
          </Link>
          {stats?.user ? (
            <span className="text-sm font-semibold text-gray-900">
              Statistiques de {stats.user.name}
            </span>
          ) : (
            <span className="text-sm font-semibold text-gray-900">Statistiques utilisateur</span>
          )}
        </div>
        {stats?.user ? (
          <div className="text-right text-xs text-gray-500">
            <p>{stats.user.email}</p>
            <p>
              {stats.user.accountType === 'shop' ? 'Boutique' : 'Particulier'} ·
              {' '}
              {stats.user.role === 'manager' ? 'Gestionnaire' : 'Utilisateur'}
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!stats && !error ? (
        <p className="text-sm text-gray-500">Sélectionnez un utilisateur pour afficher ses statistiques.</p>
      ) : null}

      {stats ? (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Vue d’ensemble</h2>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => openModal('summary')}
              >
                Voir les résultats
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} helper={item.helper} />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Performances</h2>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => openModal('highlights')}
              >
                Voir les résultats
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {highlightStats.map((item) => (
                <HighlightStat key={item.label} label={item.label} value={item.value} helper={item.helper} />
              ))}
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Boutiques suivies</h2>
              <p className="text-xs text-gray-400">{followedShops.length} boutique(s)</p>
            </div>
            {followedShops.length ? (
              <>
                <div className="space-y-2">
                  {paginatedShops.map((shop) => (
                    <Link
                      key={shop.id}
                      to={buildShopPath(shop)}
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-semibold text-gray-700 transition hover:border-indigo-200 hover:text-indigo-800"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-gray-900">{shop.name}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {shop.city || 'Localisation inconnue'}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[11px] text-gray-400">
                      {formatNumber(shop.followersCount)} abonnés
                    </span>
                    </Link>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    Affichage{' '}
                    {Math.min((shopPage - 1) * SHOPS_PER_PAGE + 1, followedShops.length)}-
                    {Math.min(shopPage * SHOPS_PER_PAGE, followedShops.length)} sur {followedShops.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShopPage((prev) => Math.max(1, prev - 1))}
                      disabled={shopPage <= 1}
                      className="rounded border border-gray-200 px-2 py-1 font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopPage((prev) => Math.min(totalShopPages, prev + 1))}
                      disabled={shopPage >= totalShopPages}
                      className="rounded border border-gray-200 px-2 py-1 font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500">Aucune boutique suivie.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
                <p className="text-xs text-gray-400">6 derniers mois</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => openModal('timeline')}
              >
                Voir les résultats
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {timeline.length ? (
                timeline.map((entry) => (
                  <div key={entry.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{entry.label}</p>
                    <p className="text-lg font-semibold text-gray-900">{formatNumber(entry.count)} annonces</p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(entry.favorites)} favoris · {formatNumber(entry.clicks)} contacts
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 text-xs text-gray-500">
                  Aucune activité récente.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Répartition par catégorie</h2>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => openModal('categories')}
              >
                Voir les résultats
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.length ? (
                categories.map((category) => (
                  <span
                    key={category.category}
                    className="rounded-full border border-gray-200 bg-white px-4 py-1 text-xs font-semibold text-gray-600"
                  >
                    {category.category} · {formatNumber(category.count)} annonces
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-500">Aucune donnée catégorielle disponible.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Produits les plus engagés</h2>
                <p className="text-xs text-gray-400">Favoris + clics</p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                onClick={() => openModal('topProducts')}
              >
                Voir les résultats
              </button>
            </div>
            <div className="space-y-3">
              {topProducts.length ? (
                topProducts.map((product) => (
                <Link
                  key={product._id}
                  to={buildProductPath(product)}
                  className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{product.title}</p>
                    <p className="text-xs text-gray-500">
                      {product.category || 'Catégorie inconnue'} · {product.status || 'Statut inconnu'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-pink-500" />
                      {formatNumber(product.favorites)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-purple-500" />
                      {formatNumber(product.whatsappClicks)}
                    </span>
                    <span className="text-xs text-gray-400">{formatCurrency(product.price)}</span>
                  </div>
                </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4 text-xs text-gray-500">
                  Aucun produit avec suffisamment d'engagement.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
      {activeModal && (
        <SectionModal title={modalTitle} onClose={closeModal}>
          {renderModalContent()}
        </SectionModal>
      )}
    </div>
  );
}
