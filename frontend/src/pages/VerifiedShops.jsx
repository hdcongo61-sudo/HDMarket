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
  const { cities: configuredCities, t, language } = useAppSettings();
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
    () => (isAdmin ? t('market.verifiedShopsAdmin', 'Boutiques vérifiées (Admin)') : t('market.verifiedShops', 'Boutiques vérifiées')),
    [isAdmin, t]
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
    if (!date) return t('market.recently', 'Récemment');
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return t('notifications.today', 'Aujourd\'hui');
    if (diffDays === 1) return t('notifications.yesterday', 'Hier');
    if (diffDays < 7) return String(language || 'fr').startsWith('en') ? `${diffDays} days ago` : `Il y a ${diffDays} jours`;
    if (diffDays < 30) return String(language || 'fr').startsWith('en') ? `${Math.floor(diffDays / 7)} weeks ago` : `Il y a ${Math.floor(diffDays / 7)} semaines`;
    return then.toLocaleDateString(String(language || 'fr').startsWith('en') ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
  };

  const formatCurrency = (value) => formatPriceWithStoredSettings(value);
  const formatCount = (value) => Number(value || 0).toLocaleString(String(language || 'fr').startsWith('en') ? 'en-US' : 'fr-FR');

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
    <div className="min-h-screen bg-[#f5f2ee] text-[#231f1b]">
      <header className="verified-shops-header border-b border-[#e2dcd2] bg-white/96 backdrop-blur-xl transition-[visibility] duration-150">
        <div className="mx-auto max-w-5xl px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0e4] text-[#e85d00]">
              <Shield className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h1 className="truncate text-xl font-black tracking-tight text-[#231f1b] sm:text-2xl">{pageTitle}</h1>
                {!loading ? <span className="text-sm font-black text-[#8a8378]">({certifiedCountLabel})</span> : null}
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-[#8a8378] sm:text-sm">{t('market.verifiedSubtitle', 'Vendeurs contrôlés par HDMarket')}</p>
            </div>
            <button type="button" onClick={() => setAllShopsModalOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e2dcd2] bg-white text-[#231f1b]" aria-label={t('market.searchVerifiedShop', 'Rechercher une boutique vérifiée')}>
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllShopsModalOpen(true)}
              className="flex min-h-12 flex-1 items-center gap-3 rounded-full bg-[#f5f2ee] pl-4 pr-1.5 text-left ring-1 ring-[#eee8e0] active:scale-[0.99]"
            >
              <Search className="h-4 w-4 shrink-0 text-[#8a8378]" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#8a8378]">
                {t('market.searchVerifiedShop', 'Rechercher une boutique vérifiée')}
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black text-white"><Search className="h-4 w-4" /></span>
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCity('')}
              className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-black transition ${
                selectedCity === ''
                  ? 'bg-black text-white'
                  : 'border border-[#e2dcd2] bg-white text-[#6b6459]'
              }`}
            >
              {t('market.allCities', 'Voir toutes les villes')}
            </button>
            {cityOptions.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-black transition ${
                  selectedCity === city
                    ? 'bg-black text-white'
                    : 'border border-[#e2dcd2] bg-white text-[#6b6459]'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 pb-24 sm:px-5 sm:py-6">
        {!loading && shops.length > 0 ? (
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="text-[17px] font-black text-[#231f1b]">{t('market.recommendedShops', 'Boutiques recommandées')}</h2>
              <p className="mt-0.5 text-xs font-semibold text-[#8a8378]">{t('market.rankedByTrust', 'Classées par activité et confiance')}</p>
            </div>
            <span className="text-xs font-black text-[#8a8378]">{certifiedCountLabel} {t('market.results', 'résultats')}</span>
          </div>
        ) : null}

        {loading && !shops.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[1, 2, 3].map((item) => (
              <article key={item} className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
                <div className="flex animate-pulse items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-orange-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded-full bg-orange-100" />
                    <div className="h-3 w-28 rounded-full bg-gray-100" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((tile) => (
                    <div key={tile} className="aspect-square animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : error && !shops.length ? (
          <section className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Shield className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-gray-900">Chargement impossible</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-red-700">{error}</p>
          </section>
        ) : !shops.length ? (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00]">
              <Store className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-black text-gray-900">{t('market.noVerifiedShop', 'Aucune boutique vérifiée')}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-gray-500">
              {selectedCity
                ? t('market.noVerifiedShopInCity', 'Aucune boutique vérifiée à {city} pour le moment.').replace('{city}', selectedCity)
                : t('market.noVerifiedShopYet', 'Aucune boutique vérifiée pour le moment.')}
            </p>
            {selectedCity && (
              <button
                type="button"
                onClick={() => setSelectedCity('')}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-black px-5 text-sm font-black text-white"
              >
                {t('market.allCities', 'Voir toutes les villes')}
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
                  : t('market.recently', 'Récemment');
              const shopRank = topFollowerShops.findIndex((candidate) => candidate._id === shop._id);
              const isTopShop = shopRank >= 0 && shopRank < 3;
              const isBestReviewed = bestReviewedShop?._id === shop._id;

              return (
                <article
                  key={shop._id}
                  className="overflow-hidden rounded-2xl border border-[#e2dcd2] bg-white shadow-[0_3px_14px_rgba(35,31,27,0.05)] transition active:scale-[0.995]"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={buildShopPath(shop)} className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={shop.shopLogo || '/api/placeholder/80/80'}
                            alt={shop.shopName || shop.name || 'Boutique'}
                            className="h-14 w-14 rounded-full border-2 border-gray-200 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#e85d00] px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
                            HD
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-black text-gray-900">
                              {shop.shopName || shop.name}
                            </h2>
                            <VerifiedBadge verified showLabel={false} />
                            {isTopShop ? <span className="text-[10px] font-black text-[#c2410c]">TOP {shopRank + 1}</span> : null}
                            {isBestReviewed ? <span className="text-[10px] font-black text-emerald-700">{t('market.wellRated', 'Bien notée')}</span> : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                            <span>{lastProductDate}</span>
                            <span className="h-1 w-1 rounded-full bg-stone-300" />
                            <span className="inline-flex min-w-0 items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{shop.shopAddress || shop.city || t('market.addressMissing', 'Adresse non renseignée')}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>

                    {displayProducts.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
                        {displayProducts.slice(0, 3).map((item, index) => {
                          const productImage = item.images?.[0] || item.image || '/api/placeholder/200/200';
                          const productLink = item.slug
                            ? buildProductPath({ slug: item.slug, _id: item._id })
                            : buildShopPath(shop);

                          return (
                            <Link
                              key={item._id || `product-${index}`}
                              to={productLink}
                              className="group relative aspect-square overflow-hidden bg-gray-100"
                            >
                              <img
                                src={productImage}
                                alt={item.title || `Produit ${index + 1}`}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                              {item.price ? (
                                <span className="absolute bottom-1 left-1 rounded-full bg-white/94 px-2 py-1 text-[10px] font-black text-[#231f1b] shadow-sm">
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
                        className="mt-3 flex min-h-[96px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-100/50 text-sm font-black text-gray-500"
                      >
                        Entrer dans la boutique
                      </Link>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-[#8a8378]">
                      <p className="min-w-0 truncate">{formatCount(shop.followersCount || 0)} {t('market.followers', 'abonnés')} · {formatCount(shop.productCount || 0)} {t('market.products', 'produits')}</p>
                      <Link
                        to={buildShopPath(shop)}
                        className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-black px-4 text-xs font-black text-white"
                      >
                        {t('market.viewShop', 'Voir la boutique')}
                      </Link>
                    </div>
                  </div>

                  {isAdmin && meta?.shopVerifiedBy ? (
                    <div className="border-t border-gray-200 bg-gray-100/50 px-4 py-3 text-xs font-bold text-gray-500 sm:px-5">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        {t('market.verifiedBy', 'Vérifiée par')} {meta.shopVerifiedBy.name}
                        {meta.shopVerifiedAt ? ` · ${new Date(meta.shopVerifiedAt).toLocaleDateString(String(language || 'fr').startsWith('en') ? 'en-US' : 'fr-FR')}` : ''}
                      </span>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {isAdmin && !loading && !error && pendingShops.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-amber-100 bg-white p-4 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#e85d00]">
                  {t('market.reviewing', 'Vérification')}
                </p>
                <h2 className="mt-1 text-xl font-black text-gray-900">{t('market.shopsInReview', 'Boutiques en revue')}</h2>
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
                  className="rounded-2xl border border-amber-100 bg-amber-50/35 p-3 transition hover:bg-amber-50"
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
                      <p className="truncate text-sm font-black text-gray-900">{shop.shopName || shop.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {shop.shopAddress || t('market.addressPending', 'Adresse en cours')}
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
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e2dcd2] bg-white px-5 text-sm font-black text-[#6b6459]"
          >
            {t('market.backHome', 'Retourner à l’accueil')}
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
        ariaLabel={t('market.allShops', 'Toutes les boutiques')}
        panelClassName="sm:max-w-5xl"
      >
        <ModalHeader
          title={t('market.allShops', 'Toutes les boutiques')}
          subtitle={`${allShopsForModal.length} ${t('market.shopsTotal', 'boutiques au total')}`}
          icon={<Store size={18} className="text-[#e85d00]" />}
          onClose={() => {
            setAllShopsModalOpen(false);
            setAllShopsSearch('');
          }}
        />
        <ModalBody className="space-y-5">
          <div className="hd-products-search flex items-center gap-3 rounded-xl bg-white px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-gray-400" />
            <input
              type="text"
              value={allShopsSearch}
              onChange={(event) => setAllShopsSearch(event.target.value)}
              placeholder={t('market.searchShopAddress', 'Rechercher une boutique par nom ou adresse...')}
              className="min-h-[40px] w-full border-0 bg-transparent text-sm font-bold text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
            />
          </div>

          {certifiedShopsInModal.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-gray-900">{t('market.certifiedShops', 'Boutiques certifiées')}</h3>
                  <p className="text-xs font-semibold text-gray-500">
                    {certifiedShopsInModal.length} {t(certifiedShopsInModal.length > 1 ? 'market.shopsFound' : 'market.shopFound', certifiedShopsInModal.length > 1 ? 'boutiques' : 'boutique')}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-[#e85d00]" />
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
                    className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_28px_rgba(117,75,36,0.08)] transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={shop.shopLogo || '/api/placeholder/60/60'}
                        alt={shop.shopName || shop.name || 'Boutique'}
                        className="h-14 w-14 rounded-2xl border border-gray-200 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-black text-gray-900">{shop.shopName || shop.name}</p>
                          <VerifiedBadge verified showLabel={false} />
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {shop.shopAddress || t('market.addressMissing', 'Adresse non renseignée')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-gray-500">
                      <span>{formatCount(shop.productCount || 0)} {t('market.listings', 'annonces')}</span>
                      <span className="inline-flex items-center gap-1 text-[#e85d00]">
                        {t('market.view', 'Voir')} <ChevronRight className="h-3.5 w-3.5" />
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
                  <h3 className="text-lg font-black text-gray-900">{t('market.pendingCertification', 'En attente de certification')}</h3>
                  <p className="text-xs font-semibold text-gray-500">
                    {nonCertifiedShopsInModal.length} {t(nonCertifiedShopsInModal.length > 1 ? 'market.shopsFound' : 'market.shopFound', nonCertifiedShopsInModal.length > 1 ? 'boutiques' : 'boutique')} {t('market.toReview', 'à contrôler')}
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
                    className="group rounded-2xl border border-amber-100 bg-amber-50/40 p-4 transition hover:bg-amber-50"
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
                          <p className="truncate text-sm font-black text-gray-900">{shop.shopName || shop.name}</p>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                            {t('market.underReview', 'En revue')}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-gray-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {shop.shopAddress || t('market.addressMissing', 'Adresse non renseignée')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {allShopsForModal.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00]">
                <Search size={30} />
              </div>
              <p className="text-sm font-black text-gray-900">{t('market.noShopFound', 'Aucune boutique trouvée')}</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">{t('market.changeSearch', 'Essayez de modifier votre recherche.')}</p>
            </div>
          ) : null}
        </ModalBody>
      </BaseModal>
    </div>
  );
}
