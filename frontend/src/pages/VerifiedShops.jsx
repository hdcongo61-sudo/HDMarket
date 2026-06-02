import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { buildShopPath, buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  Shield,
  Store,
  MapPin,
  User,
  Crown,
  Heart,
  ShoppingCart,
  Eye,
  Award,
  MoreVertical,
  ChevronRight,
  Search,
  CheckCircle,
  Clock,
  Grid3x3
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import BaseModal, { ModalBody, ModalHeader } from '../components/modals/BaseModal';
import { loadOfflineSnapshot, saveOfflineSnapshot } from '../utils/offlineSnapshots';

const VERIFIED_SHOPS_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 15;

export default function VerifiedShops() {
  const { user } = useContext(AuthContext);
  const { cities: configuredCities } = useAppSettings();
  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  const [selectedCity, setSelectedCity] = useState('');
  const [shops, setShops] = useState([]);
  const hasAppliedDefaultCity = useRef(false);
  const cityOptions = useMemo(() => {
    const cityNames = Array.isArray(configuredCities)
      ? configuredCities
          .map((entry) => String(entry?.name || '').trim())
          .filter(Boolean)
      : [];
    return Array.from(new Set(cityNames));
  }, [configuredCities]);

  // Default to connected user's city once when available
  useEffect(() => {
    if (hasAppliedDefaultCity.current) return;
    const userCity = String(user?.city || '').trim();
    if (userCity && cityOptions.includes(userCity)) {
      setSelectedCity(userCity);
      hasAppliedDefaultCity.current = true;
    }
  }, [cityOptions, user?.city]);
  const [pendingShops, setPendingShops] = useState([]);
  const bestReviewedShop = useMemo(() => {
    if (!shops.length) return null;
    return shops.reduce((best, candidate) => {
      if (!best) return candidate;
      const bestCount = Number(best.ratingCount ?? 0);
      const candidateCount = Number(candidate.ratingCount ?? 0);
      if (candidateCount > bestCount) return candidate;
      if (candidateCount === bestCount) {
        const bestAverage = Number(best.ratingAverage ?? 0);
        const candidateAverage = Number(candidate.ratingAverage ?? 0);
        return candidateAverage > bestAverage ? candidate : best;
      }
      return best;
    }, null);
  }, [shops]);
  const topFollowerShops = useMemo(() => {
    if (!shops.length) return [];
    return [...shops]
      .sort((a, b) => Number(b.followersCount ?? 0) - Number(a.followersCount ?? 0))
      .slice(0, 3);
  }, [shops]);
  const [adminMeta, setAdminMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shopProducts, setShopProducts] = useState(new Map()); // Map<shopId, products[]>
  const [allShopsModalOpen, setAllShopsModalOpen] = useState(false);
  const [allShopsSearch, setAllShopsSearch] = useState('');
  const verifiedShopsSnapshotKey = useMemo(
    () => `verified-shops:${selectedCity || 'all'}:${isAdmin ? 'admin' : 'public'}`,
    [isAdmin, selectedCity]
  );

  useEffect(() => {
    let active = true;
    const fetchShops = async () => {
      let snapshotHydrated = false;
      try {
        const snapshot = await loadOfflineSnapshot(verifiedShopsSnapshotKey, {
          maxAgeMs: VERIFIED_SHOPS_SNAPSHOT_MAX_AGE_MS
        });
        if (snapshot && typeof snapshot === 'object' && active) {
          setShops(Array.isArray(snapshot.shops) ? snapshot.shops : []);
          setPendingShops(Array.isArray(snapshot.pendingShops) ? snapshot.pendingShops : []);
          setAdminMeta(snapshot.adminMeta && typeof snapshot.adminMeta === 'object' ? snapshot.adminMeta : {});
          setShopProducts(new Map(Array.isArray(snapshot.shopProducts) ? snapshot.shopProducts : []));
          setError('');
          setLoading(false);
          snapshotHydrated = true;
        } else {
          setLoading(true);
          setError('');
        }

        const { data: allShops } = await api.get('/shops', {
          params: {
            withImages: true,
            imageLimit: 6,
            ...(selectedCity ? { city: selectedCity } : {})
          }
        });
        const publicData = Array.isArray(allShops) ? allShops : [];
        const verifiedList = publicData.filter((shop) => shop.shopVerified);
        const unverifiedList = publicData.filter((shop) => !shop.shopVerified);
        if (!active) return;
        setShops(verifiedList);
        setPendingShops(unverifiedList);
        if (!snapshotHydrated) {
          setShopProducts(new Map());
          setAdminMeta({});
        }
        setLoading(false);

        void Promise.all(
          verifiedList.slice(0, 20).map(async (shop) => {
            try {
              const shopId = shop.slug || shop._id;
              if (!shopId) return null;
              const { data: shopData } = await api.get(`/shops/${shopId}`, {
                params: { limit: 6 }
              });
              const products = Array.isArray(shopData?.products) ? shopData.products.slice(0, 6) : [];
              return [shop._id, products];
            } catch {
              return [shop._id, []];
            }
          })
        ).then((entries) => {
          if (!active) return;
          setShopProducts(new Map(entries.filter(Boolean)));
        });

        if (isAdmin) {
          void api
            .get('/admin/shops/verified')
            .then(({ data: adminData }) => {
              if (!active) return;
              const map = {};
              (adminData || []).forEach((item) => {
                map[item.id] = item;
              });
              setAdminMeta(map);
            })
            .catch((adminError) => {
              console.error('Erreur chargement meta admin:', adminError);
            });
        } else {
          setAdminMeta({});
        }
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Impossible de charger les boutiques.');
        if (!snapshotHydrated) {
          setShops([]);
          setPendingShops([]);
        }
      } finally {
        if (active && !snapshotHydrated) setLoading(false);
      }
    };

    fetchShops();
    return () => {
      active = false;
    };
  }, [isAdmin, selectedCity, verifiedShopsSnapshotKey]);

  useEffect(() => {
    if (loading && !shops.length && !pendingShops.length) return;
    saveOfflineSnapshot(verifiedShopsSnapshotKey, {
      shops,
      pendingShops,
      adminMeta,
      shopProducts: Array.from(shopProducts.entries())
    });
  }, [adminMeta, loading, pendingShops, shopProducts, shops, verifiedShopsSnapshotKey]);

  const pageTitle = useMemo(
    () => (isAdmin ? 'Boutiques vérifiées (Admin)' : 'Boutiques vérifiées'),
    [isAdmin]
  );

  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useMemo(
    () => (url) => {
      if (!url) return '';
      if (/^https?:\/\//i.test(url)) return url;
      const cleaned = url.replace(/\\/g, '/');
      return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
    },
    [filesBase]
  );

  const shopImageMap = useMemo(() => {
    const map = new Map();
    shops.forEach((shop) => {
      const baseImages = Array.isArray(shop.sampleImages) ? shop.sampleImages : [];
      const coverImage = shop.shopBanner ? normalizeUrl(shop.shopBanner) : '';
      const logoImage = shop.shopLogo ? normalizeUrl(shop.shopLogo) : '';
      const pool = baseImages
        .filter(Boolean)
        .map(normalizeUrl)
        .filter((image) => image && image !== coverImage && image !== logoImage);
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const tiles = shuffled.slice(0, 6);
      map.set(shop._id, tiles);
    });
    return map;
  }, [shops, normalizeUrl]);

  const certifiedCountLabel = useMemo(
    () => Number(shops.length || 0).toLocaleString('fr-FR'),
    [shops.length]
  );

  // Helper function to check if a shop is currently boosted based on date range
  const isShopCurrentlyBoosted = useMemo(() => (shop) => {
    if (!shop.shopBoosted) return false;
    
    const now = new Date();
    const hasStartDate = shop.shopBoostStartDate !== null && shop.shopBoostStartDate !== undefined;
    const hasEndDate = shop.shopBoostEndDate !== null && shop.shopBoostEndDate !== undefined;
    
    // If no dates are set, consider it always boosted (backward compatibility)
    if (!hasStartDate && !hasEndDate) {
      return true;
    }
    
    // Check if current date is within the boost range
    if (hasStartDate && now < new Date(shop.shopBoostStartDate)) {
      return false; // Boost hasn't started yet
    }
    
    if (hasEndDate && now > new Date(shop.shopBoostEndDate)) {
      return false; // Boost has ended
    }
    
    return true;
  }, []);

  // Display order: boosted shops first (by boost score), then by followers
  const shopsSortedByFollowers = useMemo(() => {
    if (!shops.length) return [];
    return [...shops].sort((a, b) => {
      const aIsBoosted = isShopCurrentlyBoosted(a);
      const bIsBoosted = isShopCurrentlyBoosted(b);
      
      // Boosted shops first
      if (aIsBoosted && !bIsBoosted) return -1;
      if (!aIsBoosted && bIsBoosted) return 1;
      
      // If both boosted or both not boosted, sort by boost score (if boosted) then followers
      if (aIsBoosted && bIsBoosted) {
        const aScore = Number(a.shopBoostScore ?? 0);
        const bScore = Number(b.shopBoostScore ?? 0);
        if (aScore !== bScore) return bScore - aScore;
      }
      
      // Then by followers count
      const aFollowers = Number(a.followersCount ?? 0);
      const bFollowers = Number(b.followersCount ?? 0);
      if (aFollowers !== bFollowers) return bFollowers - aFollowers;
      
      return 0;
    });
  }, [shops, isShopCurrentlyBoosted]);

  const formatRelativeTime = (date) => {
    if (!date) return 'Récemment';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    return then.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatCurrency = (value) => formatPriceWithStoredSettings(value);
  const formatCount = (value) => Number(value || 0).toLocaleString('fr-FR');

  // Filter all shops for modal
  const allShopsForModal = useMemo(() => {
    const all = [...shops, ...pendingShops];
    if (!allShopsSearch.trim()) return all;
    const query = allShopsSearch.toLowerCase().trim();
    return all.filter(
      (shop) =>
        shop.shopName?.toLowerCase().includes(query) ||
        shop.shopAddress?.toLowerCase().includes(query) ||
        shop.name?.toLowerCase().includes(query)
    );
  }, [shops, pendingShops, allShopsSearch]);

  const certifiedShopsInModal = useMemo(() => {
    const certified = allShopsForModal.filter((shop) => shop.shopVerified);
    return [...certified].sort((a, b) => {
      const aIsBoosted = isShopCurrentlyBoosted(a);
      const bIsBoosted = isShopCurrentlyBoosted(b);
      
      // Boosted shops first
      if (aIsBoosted && !bIsBoosted) return -1;
      if (!aIsBoosted && bIsBoosted) return 1;
      
      // If both boosted or both not boosted, sort by boost score (if boosted) then followers
      if (aIsBoosted && bIsBoosted) {
        const aScore = Number(a.shopBoostScore ?? 0);
        const bScore = Number(b.shopBoostScore ?? 0);
        if (aScore !== bScore) return bScore - aScore;
      }
      
      // Then by followers count
      const aFollowers = Number(a.followersCount ?? 0);
      const bFollowers = Number(b.followersCount ?? 0);
      if (aFollowers !== bFollowers) return bFollowers - aFollowers;
      
      return 0;
    });
  }, [allShopsForModal, isShopCurrentlyBoosted]);
  const nonCertifiedShopsInModal = useMemo(
    () => allShopsForModal.filter((shop) => !shop.shopVerified),
    [allShopsForModal]
  );

  return (
    <div className="hd-products-flow min-h-screen bg-[#f6f2ec] text-stone-950">
      <header className="verified-shops-header sticky top-0 z-40 border-b border-orange-100/70 bg-[#fff7ee]/95 backdrop-blur-xl transition-[visibility] duration-150">
        <div className="mx-auto max-w-5xl px-3 py-3 sm:px-5">
          <nav className="flex items-center gap-5 overflow-x-auto pb-2 hide-scrollbar">
            {['Suivies', 'Recommandées', 'Nouveautés', 'Top local', 'Certifiées'].map((tab, index) => (
              <span
                key={tab}
                className={`relative shrink-0 text-base font-black tracking-tight ${
                  index === 1 ? 'text-[#FF6A00]' : 'text-stone-900'
                }`}
              >
                {tab}
                {index === 1 ? (
                  <span className="absolute -bottom-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#FF6A00]" />
                ) : null}
              </span>
            ))}
          </nav>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllShopsModalOpen(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-orange-200 bg-white text-[#FF6A00] shadow-[0_8px_20px_rgba(255,106,0,0.12)] active:scale-95"
              aria-label="Voir toutes les boutiques"
            >
              <Grid3x3 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setAllShopsModalOpen(true)}
              className="flex min-h-[48px] flex-1 items-center gap-3 rounded-[18px] border-2 border-[#FF6A00] bg-white px-4 text-left shadow-[0_10px_24px_rgba(255,106,0,0.12)] active:scale-[0.99]"
            >
              <Search className="h-5 w-5 shrink-0 text-stone-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-black text-stone-900">
                Rechercher une boutique vérifiée
              </span>
              <span className="rounded-full bg-[#FF6A00] px-4 py-2 text-sm font-black text-white">
                Search
              </span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCity('')}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
                selectedCity === ''
                  ? 'bg-[#FF6A00] text-white shadow-[0_8px_18px_rgba(255,106,0,0.22)]'
                  : 'border border-orange-100 bg-white text-stone-700'
              }`}
            >
              Toutes les villes
            </button>
            {cityOptions.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${
                  selectedCity === city
                    ? 'bg-[#FF6A00] text-white shadow-[0_8px_18px_rgba(255,106,0,0.22)]'
                    : 'border border-orange-100 bg-white text-stone-700'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 pb-24 sm:px-5 sm:py-6">
        <section className="hd-products-hero mb-4 rounded-[28px] p-4 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 ring-1 ring-white/20">
                <Shield className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wide">
                  Marketplace certifiée
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Boutiques vérifiées
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86">
                Découvrez des vendeurs contrôlés, leurs nouveautés et les produits populaires dans un flux rapide à parcourir.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/18">
                <p className="text-lg font-black">{certifiedCountLabel}</p>
                <p className="text-[11px] font-bold text-white/72">certifiées</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/18">
                <p className="text-lg font-black">{formatCount(pendingShops.length)}</p>
                <p className="text-[11px] font-bold text-white/72">en revue</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/18">
                <p className="text-lg font-black">{formatCount(shops.reduce((sum, shop) => sum + Number(shop.productCount || 0), 0))}</p>
                <p className="text-[11px] font-bold text-white/72">annonces</p>
              </div>
            </div>
          </div>
        </section>

        {loading && !shops.length ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <article key={item} className="overflow-hidden rounded-[28px] border border-orange-100 bg-white p-4 shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
                <div className="flex animate-pulse items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-orange-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded-full bg-orange-100" />
                    <div className="h-3 w-28 rounded-full bg-stone-100" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((tile) => (
                    <div key={tile} className="aspect-square animate-pulse rounded-xl bg-stone-100" />
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : error && !shops.length ? (
          <section className="rounded-[28px] border border-red-100 bg-white p-6 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Shield className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-stone-950">Chargement impossible</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-red-700">{error}</p>
          </section>
        ) : !shops.length ? (
          <section className="rounded-[28px] border border-dashed border-orange-200 bg-white p-8 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-[#FF6A00]">
              <Store className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-black text-stone-950">Aucune boutique vérifiée</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-stone-500">
              {selectedCity
                ? `Aucune boutique vérifiée à ${selectedCity} pour le moment.`
                : 'Aucune boutique vérifiée pour le moment.'}
            </p>
            {selectedCity && (
              <button
                type="button"
                onClick={() => setSelectedCity('')}
                className="hd-primary-button mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-black"
              >
                Voir toutes les villes
              </button>
            )}
          </section>
        ) : (
          <div className="space-y-4">
            {shopsSortedByFollowers.map((shop) => {
              const meta = adminMeta[String(shop._id)];
              const products = shopProducts.get(shop._id) || [];
              const shopImages = shopImageMap.get(shop._id) || [];
              const displayProducts = products.length > 0
                ? products
                : shopImages.slice(0, 6).map((img, index) => ({ images: [img], _id: `img-${index}` }));
              const lastProductDate = products.length > 0 && products[0]?.createdAt
                ? formatRelativeTime(products[0].createdAt)
                : shop.createdAt
                  ? formatRelativeTime(shop.createdAt)
                  : 'Récemment';
              const shopRank = topFollowerShops.findIndex((candidate) => candidate._id === shop._id);
              const isTopShop = shopRank >= 0 && shopRank < 3;
              const isBestReviewed = bestReviewedShop?._id === shop._id;

              return (
                <article
                  key={shop._id}
                  className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-[0_14px_34px_rgba(117,75,36,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(117,75,36,0.12)]"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={buildShopPath(shop)} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={shop.shopLogo || '/api/placeholder/80/80'}
                            alt={shop.shopName || shop.name || 'Boutique'}
                            className="h-14 w-14 rounded-full border-2 border-orange-100 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6A00] px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
                            HD
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-black text-stone-950">
                              {shop.shopName || shop.name}
                            </h2>
                            <VerifiedBadge verified showLabel={false} />
                            {isTopShop ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-[#9A4A00] ring-1 ring-orange-100">
                                <Award className="h-3 w-3" />
                                TOP {shopRank + 1}
                              </span>
                            ) : null}
                            {isBestReviewed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                                <Crown className="h-3 w-3" />
                                Avis
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
                            <span>{lastProductDate}</span>
                            <span className="h-1 w-1 rounded-full bg-stone-300" />
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{shop.shopAddress || shop.city || 'Adresse non renseignée'}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setAllShopsModalOpen(true)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50 text-stone-500 active:scale-95"
                        aria-label="Plus d'options"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>

                    <p className="mt-4 text-sm font-semibold leading-6 text-stone-800">
                      <span className="font-black text-emerald-600">Nouveau</span>
                      {' '}
                      Découvrez les derniers produits de {shop.shopName || shop.name}. Boutique vérifiée par HDMarket.
                    </p>

                    {displayProducts.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-1.5 overflow-hidden rounded-[18px]">
                        {displayProducts.slice(0, 6).map((item, index) => {
                          const productImage = item.images?.[0] || item.image || '/api/placeholder/200/200';
                          const productLink = item.slug
                            ? buildProductPath({ slug: item.slug, _id: item._id })
                            : buildShopPath(shop);

                          return (
                            <Link
                              key={item._id || `product-${index}`}
                              to={productLink}
                              className="group relative aspect-square overflow-hidden bg-stone-100"
                            >
                              <img
                                src={productImage}
                                alt={item.title || `Produit ${index + 1}`}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                              {item.price ? (
                                <span className="absolute bottom-1 left-1 rounded-full bg-white/92 px-2 py-1 text-[10px] font-black text-[#FF6A00] shadow-sm">
                                  {formatCurrency(item.price)}
                                </span>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <Link
                        to={buildShopPath(shop)}
                        className="mt-3 flex min-h-[96px] items-center justify-center rounded-[18px] border border-dashed border-orange-200 bg-orange-50/50 text-sm font-black text-[#9A4A00]"
                      >
                        Entrer dans la boutique
                      </Link>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-stone-500">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Heart className="h-4 w-4 text-[#FF6A00]" />
                          {formatCount(shop.followersCount || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ShoppingCart className="h-4 w-4 text-stone-700" />
                          {formatCount(shop.productCount || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Eye className="h-4 w-4 text-stone-500" />
                          {formatCount(shop.totalViews ?? Math.floor((shop.productCount || 0) * 12.5))}
                        </span>
                      </div>
                      <Link
                        to={buildShopPath(shop)}
                        className="shrink-0 rounded-full bg-[#FF6A00] px-4 py-2 text-xs font-black text-white shadow-[0_8px_18px_rgba(255,106,0,0.22)]"
                      >
                        Voir
                      </Link>
                    </div>
                  </div>

                  {isAdmin && meta?.shopVerifiedBy ? (
                    <div className="border-t border-orange-100 bg-orange-50/50 px-4 py-3 text-xs font-bold text-[#9A4A00] sm:px-5">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        Vérifiée par {meta.shopVerifiedBy.name}
                        {meta.shopVerifiedAt ? ` le ${new Date(meta.shopVerifiedAt).toLocaleDateString('fr-FR')}` : ''}
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && pendingShops.length > 0 ? (
          <section className="mt-6 rounded-[28px] border border-amber-100 bg-white p-4 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#FF6A00]">
                  Vérification
                </p>
                <h2 className="mt-1 text-xl font-black text-stone-950">Boutiques en revue</h2>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                {formatCount(pendingShops.length)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingShops.map((shop) => (
                <Link
                  key={`pending-${shop._id}`}
                  to={buildShopPath(shop)}
                  className="rounded-[22px] border border-amber-100 bg-amber-50/35 p-3 transition hover:bg-amber-50"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.shopLogo || '/api/placeholder/80/80'}
                      alt={shop.shopName || shop.name || 'Boutique'}
                      className="h-12 w-12 rounded-2xl border border-amber-100 object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-stone-950">{shop.shopName || shop.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-stone-500">
                        <MapPin className="h-3 w-3" />
                        {shop.shopAddress || 'Adresse en cours'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="py-2 text-center">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-orange-100 bg-white px-5 text-sm font-black text-[#9A4A00] shadow-sm"
          >
            Retourner à l&apos;accueil
          </Link>
        </div>
      </main>

      <BaseModal
        isOpen={allShopsModalOpen}
        onClose={() => {
          setAllShopsModalOpen(false);
          setAllShopsSearch('');
        }}
        size="xl"
        mobileSheet
        ariaLabel="Toutes les boutiques"
        panelClassName="sm:max-w-5xl hd-products-flow"
      >
        <ModalHeader
          title="Toutes les boutiques"
          subtitle={`${allShopsForModal.length} boutique${allShopsForModal.length > 1 ? 's' : ''} au total`}
          icon={<Store size={18} className="text-[#FF6A00]" />}
          onClose={() => {
            setAllShopsModalOpen(false);
            setAllShopsSearch('');
          }}
        />
        <ModalBody className="space-y-5">
          <div className="hd-products-search flex items-center gap-3 rounded-[20px] bg-white px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-stone-400" />
            <input
              type="text"
              value={allShopsSearch}
              onChange={(event) => setAllShopsSearch(event.target.value)}
              placeholder="Rechercher une boutique par nom ou adresse..."
              className="min-h-[40px] w-full border-0 bg-transparent text-sm font-bold text-stone-900 outline-none placeholder:text-stone-400 focus:ring-0"
            />
          </div>

          {certifiedShopsInModal.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-stone-950">Boutiques certifiées</h3>
                  <p className="text-xs font-semibold text-stone-500">
                    {certifiedShopsInModal.length} boutique{certifiedShopsInModal.length > 1 ? 's' : ''} vérifiée{certifiedShopsInModal.length > 1 ? 's' : ''}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-[#FF6A00]" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {certifiedShopsInModal.map((shop) => (
                  <Link
                    key={`certified-${shop._id}`}
                    to={buildShopPath(shop)}
                    onClick={() => {
                      setAllShopsModalOpen(false);
                      setAllShopsSearch('');
                    }}
                    className="group rounded-[24px] border border-orange-100 bg-white p-4 shadow-[0_12px_28px_rgba(117,75,36,0.08)] transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={shop.shopLogo || '/api/placeholder/60/60'}
                        alt={shop.shopName || shop.name || 'Boutique'}
                        className="h-14 w-14 rounded-2xl border border-orange-100 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-stone-950">{shop.shopName || shop.name}</p>
                          <VerifiedBadge verified showLabel={false} />
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-stone-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {shop.shopAddress || 'Adresse non renseignée'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-stone-500">
                      <span>{formatCount(shop.productCount || 0)} annonces</span>
                      <span className="inline-flex items-center gap-1 text-[#FF6A00]">
                        Voir <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {nonCertifiedShopsInModal.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-stone-950">En attente de certification</h3>
                  <p className="text-xs font-semibold text-stone-500">
                    {nonCertifiedShopsInModal.length} boutique{nonCertifiedShopsInModal.length > 1 ? 's' : ''} à contrôler
                  </p>
                </div>
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nonCertifiedShopsInModal.map((shop) => (
                  <Link
                    key={`non-certified-${shop._id}`}
                    to={buildShopPath(shop)}
                    onClick={() => {
                      setAllShopsModalOpen(false);
                      setAllShopsSearch('');
                    }}
                    className="group rounded-[24px] border border-amber-100 bg-amber-50/40 p-4 transition hover:bg-amber-50"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={shop.shopLogo || '/api/placeholder/60/60'}
                        alt={shop.shopName || shop.name || 'Boutique'}
                        className="h-14 w-14 rounded-2xl border border-amber-100 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-stone-950">{shop.shopName || shop.name}</p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                            En revue
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-stone-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {shop.shopAddress || 'Adresse non renseignée'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {allShopsForModal.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-orange-200 bg-white py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-[#FF6A00]">
                <Search size={30} />
              </div>
              <p className="text-sm font-black text-stone-950">Aucune boutique trouvée</p>
              <p className="mt-1 text-xs font-semibold text-stone-500">Essayez de modifier votre recherche.</p>
            </div>
          ) : null}
        </ModalBody>
      </BaseModal>
    </div>
  );
}
