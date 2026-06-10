import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Compass,
  Flame,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp
} from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import ShimmerSkeleton from '../components/ui/ShimmerSkeleton';
import useCategories from '../hooks/useCategories';
import { buildProductPath, buildShopPath } from '../utils/links';
import { useAppSettings } from '../context/AppSettingsContext';
import AuthContext from '../context/AuthContext';

const sectionMeta = [
  {
    key: 'topDeals',
    title: 'Bonnes affaires',
    subtitle: 'Prix agressifs, promotions et produits faciles à comparer.',
    icon: BadgePercent,
    to: '/products?sort=price_asc'
  },
  {
    key: 'topSales',
    title: 'Ce qui se vend',
    subtitle: 'Produits qui attirent déjà des acheteurs.',
    icon: Flame,
    to: '/products?sort=popular'
  },
  {
    key: 'newProducts',
    title: 'Nouveautés',
    subtitle: 'Les annonces récentes à explorer avant tout le monde.',
    icon: Sparkles,
    to: '/products?sort=new'
  }
];

const toItems = (value) => (Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []);

function SectionHeader({ icon: Icon, title, subtitle, to }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-orange-100 text-[#FF6A00]">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-black text-stone-950">{title}</h2>
        </div>
        <p className="mt-1 text-sm leading-5 text-stone-500">{subtitle}</p>
      </div>
      {to ? (
        <Link
          to={to}
          className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-bold text-[#9A4A00] shadow-sm ring-1 ring-orange-100 transition hover:bg-orange-50 sm:inline-flex"
        >
          Voir
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function ProductRail({ products = [], loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerSkeleton key={index} className="h-64 rounded-[22px]" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-[24px] border border-orange-100 bg-white/80 p-6 text-sm text-stone-500">
        Aucun produit disponible pour ce bloc.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {products.slice(0, 10).map((product) => (
        <ProductCard key={product._id || product.slug} p={product} productLink={buildProductPath(product)} compactMobile />
      ))}
    </div>
  );
}

export default function Discover() {
  const { categoryGroups } = useCategories();
  const { user } = useContext(AuthContext);
  const { city: preferredCity } = useAppSettings();
  const [sections, setSections] = useState({ topDeals: [], topSales: [], newProducts: [], local: [] });
  const [shops, setShops] = useState([]);
  const [loadingSections, setLoadingSections] = useState({
    local: true,
    topDeals: true,
    topSales: true,
    newProducts: true,
    shops: true
  });
  const [error, setError] = useState('');
  const city = preferredCity || user?.preferredCity || user?.city || '';

  const setSectionLoading = useCallback((key, value) => {
    setLoadingSections((prev) => ({ ...prev, [key]: value }));
  }, []);

  const categoryShortcuts = useMemo(
    () =>
      categoryGroups
        .filter((group) => Array.isArray(group.options) && group.options.length)
        .slice(0, 10)
        .map((group) => ({
          label: group.label,
          value: group.options[0]?.value || ''
        })),
    []
  );

  const loadDiscover = useCallback(async () => {
    setError('');
    setLoadingSections({
      local: true,
      topDeals: true,
      topSales: true,
      newProducts: true,
      shops: true
    });

    const loadLocal = async () => {
      try {
        const { data } = await api.get('/products/public', {
          params: {
            page: 1,
            limit: 10,
            sort: 'new',
            ...(city ? { userCity: city, locationPriority: true } : {})
          }
        });
        setSections((prev) => ({
          ...prev,
          local: toItems(data).slice(0, 10)
        }));
      } catch (err) {
        setError(err?.response?.data?.message || 'Impossible de charger la découverte.');
      } finally {
        setSectionLoading('local', false);
      }
    };

    const loadHighlights = async () => {
      try {
        const { data } = await api.get('/products/public/highlights', { silentGlobalError: true });
        setSections((prev) => ({
          ...prev,
          topDeals: toItems(data?.topDeals || data?.topDiscounts).slice(0, 10),
          newProducts: toItems(data?.newProducts).slice(0, 10)
        }));
      } catch {
        setSections((prev) => ({ ...prev, topDeals: [], newProducts: [] }));
      } finally {
        setSectionLoading('topDeals', false);
        setSectionLoading('newProducts', false);
      }
    };

    const loadTopSales = async () => {
      try {
        const { data } = await api.get('/products/public/top-sales', {
          params: { limit: 10, page: 1 },
          silentGlobalError: true
        });
        setSections((prev) => ({
          ...prev,
          topSales: toItems(data).slice(0, 10)
        }));
      } catch {
        setSections((prev) => ({ ...prev, topSales: [] }));
      } finally {
        setSectionLoading('topSales', false);
      }
    };

    const loadShops = async () => {
      try {
        const { data } = await api.get('/shops', {
          params: {
            verified: 'true',
            limit: 8,
            withViews: 'false',
            withRatings: 'false',
            withProductCounts: 'false'
          },
          silentGlobalError: true
        });
        setShops(toItems(data).slice(0, 8));
      } catch {
        setShops([]);
      } finally {
        setSectionLoading('shops', false);
      }
    };

    loadLocal();
    window.setTimeout(loadHighlights, 80);
    window.setTimeout(loadTopSales, 160);
    window.setTimeout(loadShops, 240);
  }, [city, setSectionLoading]);

  useEffect(() => {
    loadDiscover();
  }, [loadDiscover]);

  return (
    <div className="hd-search-flow hd-commerce-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-3 pb-12 pt-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[30px] border border-orange-100 bg-[#fffaf4] p-5 shadow-[0_24px_70px_rgba(117,75,36,0.12)] sm:p-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-200/45 blur-3xl" />
          <div className="relative z-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase text-[#B45309]">
                <Compass className="h-3.5 w-3.5" />
                Découvrir
              </div>
              <h1 className="max-w-3xl text-3xl font-black leading-tight text-stone-950 sm:text-5xl">
                Trouvez plus vite les produits qui valent le détour.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                Une navigation pensée pour mobile: recherche persistante, raccourcis catégories, produits locaux et recommandations à forte intention d’achat.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-[24px] bg-white/70 p-2 ring-1 ring-orange-100">
              {[
                { label: 'Local', value: city || 'Toutes villes', icon: MapPin },
                { label: 'Tendance', value: 'Top ventes', icon: TrendingUp },
                { label: 'Fiable', value: 'Boutiques', icon: ShieldCheck }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl bg-[#fff7ef] p-3">
                    <Icon className="h-4 w-4 text-[#FF6A00]" />
                    <p className="mt-2 text-[11px] font-bold uppercase text-stone-400">{item.label}</p>
                    <p className="truncate text-sm font-black text-stone-900">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <div className="mobile-scroll-x flex gap-2 pb-1">
            <Link to="/products" className="hd-category-chip inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold">
              <Search className="h-4 w-4 text-[#FF6A00]" />
              Tous les produits
            </Link>
            {categoryShortcuts.map((category) => (
              <Link
                key={category.value || category.label}
                to={`/categories/${category.value}`}
                className="hd-category-chip inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold"
              >
                <Package className="h-4 w-4 text-[#FF6A00]" />
                {category.label}
              </Link>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-3xl border border-orange-100 bg-white p-5 text-sm font-semibold text-stone-600">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          <SectionHeader
            icon={MapPin}
            title={city ? `À découvrir à ${city}` : 'Sélection locale'}
            subtitle="Priorité aux produits proches quand votre ville est connue."
            to="/products"
          />
          <ProductRail products={sections.local} loading={loadingSections.local} />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="hd-surface rounded-[26px] p-4">
            <SectionHeader icon={Store} title="Boutiques à suivre" subtitle="Vendeurs vérifiés pour une navigation plus sûre." to="/shops/verified" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(loadingSections.shops ? Array.from({ length: 4 }) : shops).map((shop, index) =>
                loadingSections.shops ? (
                  <ShimmerSkeleton key={index} className="h-28 rounded-3xl" />
                ) : (
                  <Link key={shop._id || shop.slug} to={buildShopPath(shop)} className="rounded-3xl bg-white p-3 ring-1 ring-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-50">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-orange-50">
                      {shop.shopLogo ? <img src={shop.shopLogo} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                    </div>
                    <p className="mt-3 truncate text-sm font-black text-stone-950">{shop.shopName || shop.name || 'Boutique'}</p>
                    <p className="text-xs text-stone-500">Boutique vérifiée</p>
                  </Link>
                )
              )}
            </div>
          </div>

          <div className="rounded-[26px] bg-[#FF6A00] p-5 text-white shadow-[0_20px_60px_rgba(255,106,0,0.22)]">
            <ShoppingBag className="h-8 w-8" />
            <h2 className="mt-4 text-2xl font-black">Navigation rapide</h2>
            <p className="mt-2 text-sm leading-6 text-white/86">
              Explorez par envie, ville, promo ou tendance. L’objectif est de réduire les détours avant le produit.
            </p>
            <div className="mt-5 grid gap-2">
              {[
                { label: 'Promotions', to: '/products?sort=price_asc' },
                { label: 'Nouveautés', to: '/products?sort=new' },
                { label: 'Boutiques vérifiées', to: '/shops/verified' }
              ].map((item) => (
                <Link key={item.label} to={item.to} className="flex items-center justify-between rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold backdrop-blur transition hover:bg-white/22">
                  {item.label}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {sectionMeta.map((meta) => (
          <section key={meta.key} className="mt-8">
            <SectionHeader {...meta} />
            <ProductRail products={sections[meta.key]} loading={loadingSections[meta.key]} />
          </section>
        ))}
      </div>
    </div>
  );
}
