import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Compass,
  MapPin,
  Search,
  ShieldCheck,
  Store
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
    titleKey: 'market.deals',
    subtitleKey: 'market.dealsSubtitle',
    to: '/products?sort=price_asc'
  },
  {
    key: 'topSales',
    titleKey: 'market.topSales',
    subtitleKey: 'market.topSalesSubtitle',
    to: '/products?sort=popular'
  },
  {
    key: 'newProducts',
    titleKey: 'market.new',
    subtitleKey: 'market.newSubtitle',
    to: '/products?sort=new'
  }
];

const toItems = (value) => (Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : []);

function SectionHeader({ title, subtitle, to, viewAllLabel = 'Voir tout' }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-black leading-6 text-[#231f1b]">{title}</h2>
        <p className="mt-0.5 line-clamp-1 text-xs font-semibold leading-5 text-[#8a8378] sm:text-sm">{subtitle}</p>
      </div>
      {to ? (
        <Link
          to={to}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 px-1 text-xs font-black text-[#c2410c]"
        >
          {viewAllLabel}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function ProductRail({ products = [], loading = false, emptyLabel = 'Aucun produit disponible.' }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <ShimmerSkeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e2dcd2] bg-white p-6 text-sm font-semibold text-[#8a8378]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {products.slice(0, 10).map((product) => (
        <ProductCard key={product._id || product.slug} p={product} productLink={buildProductPath(product)} compactMobile commerceFeed />
      ))}
    </div>
  );
}

export default function Discover() {
  const { categoryGroups } = useCategories();
  const { user } = useContext(AuthContext);
  const { city: preferredCity, t } = useAppSettings();
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
    <div className="min-h-screen bg-[#f5f2ee] text-[#231f1b]">
      <div className="mx-auto max-w-7xl px-3 pb-24 pt-3 sm:px-6 sm:pt-6 lg:px-8 md:pb-16">
        <header className="rounded-2xl border border-[#e2dcd2] bg-white p-3 shadow-[0_3px_14px_rgba(35,31,27,0.05)] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0e4] text-[#e85d00]">
              <Compass className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black tracking-tight text-[#231f1b] sm:text-2xl">{t('market.discover', 'Découvrir')}</h1>
              <p className="mt-0.5 truncate text-xs font-semibold text-[#8a8378] sm:text-sm">{t('market.discoverSubtitle', 'Produits, tendances et boutiques à explorer')}</p>
            </div>
            <span className="inline-flex min-h-11 max-w-[42%] items-center gap-1.5 rounded-full border border-[#e2dcd2] px-3 text-xs font-black text-[#6b6459]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#e85d00]" />
              <span className="truncate">{city || t('market.allCitiesShort', 'Toutes villes')}</span>
            </span>
          </div>
          <Link to="/products" className="mt-3 flex min-h-12 items-center gap-3 rounded-full bg-[#f5f2ee] pl-4 pr-1.5 text-sm font-bold text-[#8a8378] ring-1 ring-[#eee8e0]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t('market.searchProductShop', 'Rechercher un produit ou une boutique')}</span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white"><Search className="h-4 w-4" /></span>
          </Link>
        </header>

        <nav className="mt-3" aria-label="Raccourcis de découverte">
          <div className="mobile-scroll-x flex gap-2 pb-1">
            <Link to="/products" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-black px-4 text-sm font-black text-white">
              {t('market.all', 'Tout')}
            </Link>
            <Link to="/products?sort=price_asc" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-bold text-[#231f1b]">{t('market.promotions', 'Promotions')}</Link>
            <Link to="/products?sort=new" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-bold text-[#231f1b]">{t('market.new', 'Nouveautés')}</Link>
            <Link to="/shops/verified" className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-bold text-[#231f1b]">{t('market.shops', 'Boutiques')}</Link>
            {categoryShortcuts.map((category) => (
              <Link
                key={category.value || category.label}
                to={`/categories/${category.value}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#e2dcd2] bg-white px-4 text-sm font-bold text-[#231f1b]"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </nav>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#e2dcd2] bg-white p-4 text-sm font-semibold text-[#6b6459]">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          <SectionHeader
            title={city ? t('market.discoverInCity', 'À découvrir à {city}').replace('{city}', city) : t('market.localSelection', 'Sélection locale')}
            subtitle={t('market.localPriority', 'Priorité aux produits proches quand votre ville est connue.')}
            to="/products"
            viewAllLabel={t('market.viewAll', 'Voir tout')}
          />
          <ProductRail products={sections.local} loading={loadingSections.local} emptyLabel={t('market.noProducts', 'Aucun produit disponible pour ce bloc.')} />
        </section>

        <section className="mt-8">
          <SectionHeader title={t('market.shopsToFollow', 'Boutiques à suivre')} subtitle={t('market.verifiedSellers', 'Vendeurs vérifiés pour une navigation plus sûre.')} to="/shops/verified" viewAllLabel={t('market.viewAll', 'Voir tout')} />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {(loadingSections.shops ? Array.from({ length: 4 }) : shops).map((shop, index) =>
                loadingSections.shops ? (
                  <ShimmerSkeleton key={index} className="h-28 rounded-3xl" />
                ) : (
                  <Link key={shop._id || shop.slug} to={buildShopPath(shop)} className="rounded-2xl border border-[#e2dcd2] bg-white p-3 shadow-[0_3px_12px_rgba(35,31,27,0.04)] transition active:scale-[0.98]">
                    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-[#f5f2ee]">
                      {shop.shopLogo ? <img src={shop.shopLogo} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Store className="h-5 w-5 text-[#8a8378]" />}
                    </div>
                    <p className="mt-3 truncate text-sm font-black text-[#231f1b]">{shop.shopName || shop.name || 'Boutique'}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#8a8378]"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {t('market.verified', 'Vérifiée')}</p>
                  </Link>
                )
              )}
            </div>
        </section>

        {sectionMeta.map((meta) => (
          <section key={meta.key} className="mt-8">
            <SectionHeader title={t(meta.titleKey, meta.titleKey)} subtitle={t(meta.subtitleKey, meta.subtitleKey)} to={meta.to} viewAllLabel={t('market.viewAll', 'Voir tout')} />
            <ProductRail products={sections[meta.key]} loading={loadingSections[meta.key]} emptyLabel={t('market.noProducts', 'Aucun produit disponible pour ce bloc.')} />
          </section>
        ))}
      </div>
    </div>
  );
}
