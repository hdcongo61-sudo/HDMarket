import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Store,
  Tag,
  TrendingUp
} from 'lucide-react';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const numberFormatter = new Intl.NumberFormat('fr-FR');
const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return numberFormatter.format(parsed);
};
const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const SummaryCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-1.5 text-2xl font-black leading-none text-gray-900">{value}</p>
    {helper ? <p className="mt-1.5 text-xs font-medium text-gray-500">{helper}</p> : null}
  </div>
);

const HighlightStat = ({ label, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-orange-200 bg-[#FFF7F0] px-4 py-4">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#B45309]">{label}</p>
      {Icon ? <Icon size={16} className="text-[#e85d00]" /> : null}
    </div>
    <p className="mt-1.5 text-3xl font-black leading-none text-[#e85d00]">{value}</p>
    {helper ? <p className="mt-1.5 text-xs font-medium text-gray-500">{helper}</p> : null}
  </div>
);

const SectionTitle = ({ eyebrow, title, aside }) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e85d00]">{eyebrow}</p> : null}
      <h2 className="mt-0.5 text-lg font-black tracking-tight text-gray-900">{title}</h2>
    </div>
    {aside ? <p className="text-xs font-semibold text-gray-400">{aside}</p> : null}
  </div>
);

export default function AdminUserStats() {
  const { id } = useParams();
  const SHOPS_PER_PAGE = 6;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
        helper: 'Nombre de clics générés',
        icon: MessageCircle
      },
      {
        label: 'Vues totales',
        value: formatNumber(stats.performance.views),
        helper: 'Réponses aux annonces',
        icon: Eye
      },
      {
        label: 'Conversion',
        value: `${formatNumber(stats.performance.conversion)} %`,
        helper: 'Annonces approuvées',
        icon: TrendingUp
      }
    ];
  }, [stats]);

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
          Chargement des statistiques…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* ── Identité utilisateur ── */}
      <header className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
        <Link
          to="/admin/users"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 transition hover:bg-gray-50 active:scale-[0.97]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Utilisateurs
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E4] text-lg font-black uppercase text-[#e85d00]">
            {String(stats?.user?.name || 'U').charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-gray-900">
              {stats?.user ? `Statistiques de ${stats.user.name}` : 'Statistiques utilisateur'}
            </h1>
            {stats?.user ? (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-medium text-gray-500">{stats.user.email}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">
                  {stats.user.accountType === 'shop' ? 'Boutique' : 'Particulier'}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">
                  {stats.user.role === 'manager' ? 'Gestionnaire' : 'Utilisateur'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </header>

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
          {/* Performances d'abord : les chiffres qui disent si ce vendeur marche */}
          <div className="space-y-3">
            <SectionTitle eyebrow="Performance" title="Ce que génèrent ses annonces" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {highlightStats.map((item) => (
                <HighlightStat key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle eyebrow="Activité" title="Vue d’ensemble" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {summary.map((item) => (
                <SummaryCard key={item.label} label={item.label} value={item.value} helper={item.helper} />
              ))}
            </div>
          </div>

          <section className="space-y-3">
            <SectionTitle
              eyebrow="Réseau"
              title="Boutiques suivies"
              aside={`${followedShops.length} boutique${followedShops.length > 1 ? 's' : ''}`}
            />
            {followedShops.length ? (
              <>
                <div className="space-y-2">
                  {paginatedShops.map((shop) => (
                    <Link
                      key={shop.id}
                      to={buildShopPath(shop)}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 transition hover:border-orange-200 hover:bg-[#FFF7F0]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                          <Store size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">{shop.name}</p>
                          <p className="truncate text-[11px] font-medium text-gray-500">
                            {shop.city || 'Localisation inconnue'}
                          </p>
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-[11px] font-bold text-gray-400">
                        {formatNumber(shop.followersCount)} abonnés
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
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
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopPage((prev) => Math.min(totalShopPages, prev + 1))}
                      disabled={shopPage >= totalShopPages}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-xs font-medium text-gray-500">
                Aucune boutique suivie.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle eyebrow="Historique" title="Timeline" aside="6 derniers mois" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {timeline.length ? (
                timeline.map((entry) => (
                  <div key={entry.label} className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{entry.label}</p>
                    <p className="mt-1 text-lg font-black text-gray-900">{formatNumber(entry.count)} annonces</p>
                    <p className="mt-0.5 text-xs font-medium text-gray-500">
                      {formatNumber(entry.favorites)} favoris · {formatNumber(entry.clicks)} contacts
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-xs font-medium text-gray-500">
                  Aucune activité récente.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle eyebrow="Catalogue" title="Répartition par catégorie" />
            <div className="flex flex-wrap gap-2">
              {categories.length ? (
                categories.map((category) => (
                  <span
                    key={category.category}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-600"
                  >
                    <Tag size={12} className="text-[#e85d00]" />
                    {category.category} · {formatNumber(category.count)}
                  </span>
                ))
              ) : (
                <p className="text-xs font-medium text-gray-500">Aucune donnée catégorielle disponible.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle eyebrow="Best-of" title="Produits les plus engagés" aside="Favoris + clics" />
            <div className="space-y-2">
              {topProducts.length ? (
                topProducts.map((product) => (
                  <Link
                    key={product._id}
                    to={buildProductPath(product)}
                    className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 transition hover:border-orange-200 hover:bg-[#FFF7F0] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{product.title}</p>
                      <p className="text-xs font-medium text-gray-500">
                        {product.category || 'Catégorie inconnue'} · {product.status || 'Statut inconnu'}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-4 text-xs font-semibold text-gray-500">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-[#e85d00]" />
                        {formatNumber(product.favorites)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5 text-[#e85d00]" />
                        {formatNumber(product.whatsappClicks)}
                      </span>
                      <span className="font-black text-gray-900">{formatCurrency(product.price)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-xs font-medium text-gray-500">
                  Aucun produit avec suffisamment d'engagement.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
