import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import { buildShopPath, buildProductPath } from '../utils/links';
import {
  Shield,
  Store,
  MapPin,
  Loader2,
  User,
  Crown,
  Star,
  MessageCircle,
  Users,
  Heart,
  ShoppingCart,
  Eye,
  TrendingUp,
  Award,
  MoreVertical,
  Calendar,
  Sparkles,
  ChevronRight,
  X,
  Search,
  CheckCircle,
  Clock,
  Grid3x3
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

const CITY_LIST = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];

export default function VerifiedShops() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';
  const [selectedCity, setSelectedCity] = useState('');
  const [shops, setShops] = useState([]);
  const hasAppliedDefaultCity = useRef(false);

  // Default to connected user's city once when available
  useEffect(() => {
    if (hasAppliedDefaultCity.current) return;
    if (user?.city && CITY_LIST.includes(user.city)) {
      setSelectedCity(user.city);
      hasAppliedDefaultCity.current = true;
    }
  }, [user?.city]);
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

  useEffect(() => {
    let active = true;
    const fetchShops = async () => {
      setLoading(true);
      setError('');
      try {
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

        // Fetch products for each shop
        const productsMap = new Map();
        await Promise.all(
          verifiedList.slice(0, 20).map(async (shop) => {
            try {
              const shopId = shop.slug || shop._id;
              if (!shopId) return;
              const { data: shopData } = await api.get(`/shops/${shopId}`, {
                params: { limit: 6 }
              });
              if (active && shopData?.products) {
                const products = Array.isArray(shopData.products) ? shopData.products : [];
                productsMap.set(shop._id, products.slice(0, 6));
              }
            } catch (err) {
              // Ignore individual shop errors
            }
          })
        );
        if (active) {
          setShopProducts(productsMap);
        }

        if (isAdmin) {
          try {
            const { data: adminData } = await api.get('/admin/shops/verified');
            if (!active) return;
            const map = {};
            (adminData || []).forEach((item) => {
              map[item.id] = item;
            });
            setAdminMeta(map);
          } catch (adminError) {
            console.error('Erreur chargement meta admin:', adminError);
          }
        } else {
          setAdminMeta({});
        }
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Impossible de charger les boutiques.');
        setShops([]);
        setPendingShops([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchShops();
    return () => {
      active = false;
    };
  }, [isAdmin, selectedCity]);

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

  const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
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
    <div className="min-h-screen bg-white">
      {/* Sticky header – redesigned */}
      <header className="verified-shops-header sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800/80 shadow-sm transition-[visibility] duration-150">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  Boutiques vérifiées
                </h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums font-medium">
                    {certifiedCountLabel} boutique{certifiedCountLabel !== '1' ? 's' : ''}
                  </span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAllShopsModalOpen(true)}
              className="flex-shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-3 sm:py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              <Grid3x3 className="w-4 h-4" aria-hidden />
              Voir toutes les boutiques
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* City filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <span className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            Ville
          </span>
          <div className="flex gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedCity('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                selectedCity === ''
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Toutes
            </button>
            {CITY_LIST.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                  selectedCity === city
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
                <div className="flex gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <div key={j} className="aspect-square bg-gray-200 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        ) : !shops.length ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
            <Store className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold">
              {selectedCity
                ? `Aucune boutique vérifiée à ${selectedCity} pour le moment.`
                : 'Aucune boutique vérifiée pour le moment.'}
            </p>
            {selectedCity && (
              <button
                type="button"
                onClick={() => setSelectedCity('')}
                className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Voir toutes les villes
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Feed-style Shop Cards */}
            {shopsSortedByFollowers.map((shop) => {
              const meta = adminMeta[String(shop._id)];
              const products = shopProducts.get(shop._id) || [];
              const shopImages = shopImageMap.get(shop._id) || [];
              const displayProducts = products.length > 0 ? products : shopImages.slice(0, 6).map((img, idx) => ({ images: [img], _id: `img-${idx}` }));
              const lastProductDate = products.length > 0 && products[0]?.createdAt 
                ? formatRelativeTime(products[0].createdAt) 
                : shop.createdAt 
                  ? formatRelativeTime(shop.createdAt) 
                  : 'Récemment';
              
              // Determine shop ranking badge
              const shopRank = topFollowerShops.findIndex((s) => s._id === shop._id);
              const isTopShop = shopRank >= 0 && shopRank < 3;
              const isBestReviewed = bestReviewedShop?._id === shop._id;

              return (
                <div
                  key={shop._id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Shop Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Shop Logo with Badge */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={shop.shopLogo || '/api/placeholder/60/60'}
                            alt={shop.shopName}
                            className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200"
                          />
                          {/* Promotional Badge */}
                          <div className="absolute -bottom-1 -left-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">
                            Vérifié
                          </div>
                        </div>

                        {/* Shop Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-900 truncate text-sm">
                              {shop.shopName}
                            </p>
                            <VerifiedBadge verified showLabel={false} />
                            {isTopShop && (
                              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                <Award className="w-3 h-3" />
                                TOP{shopRank + 1}
                              </span>
                            )}
                            {isBestReviewed && (
                              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                <Crown className="w-3 h-3" />
                                #1
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>{lastProductDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* More Options */}
                      <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Product Grid - Taobao Style */}
                  {displayProducts.length > 0 && (
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-2">
                        {displayProducts.slice(0, 6).map((item, index) => {
                          const productImage = item.images?.[0] || item.image || '/api/placeholder/200/200';
                          const productLink = item.slug 
                            ? buildProductPath({ slug: item.slug, _id: item._id })
                            : buildShopPath(shop);
                          const hasProductInfo = item.title || item.price;

                          return (
                            <Link
                              key={item._id || `product-${index}`}
                              to={productLink}
                              className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100"
                            >
                              <img
                                src={productImage}
                                alt={item.title || `Produit ${index + 1}`}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                              />
                              
                              {/* Discount Badge */}
                              {item.discount > 0 && (
                                <div className="absolute top-1 left-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-lg z-10">
                                  -{item.discount}%
                                </div>
                              )}

                              {/* Hover Overlay with Product Info */}
                              {hasProductInfo && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                  <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
                                    {/* Product Title */}
                                    {item.title && (
                                      <p className="text-xs font-bold mb-1.5 line-clamp-2 leading-tight">
                                        {item.title}
                                      </p>
                                    )}
                                    
                                    {/* Price */}
                                    {item.price && (
                                      <div className="flex items-baseline gap-2 mb-2">
                                        <p className="text-sm font-black text-white">
                                          {formatCurrency(item.price)}
                                        </p>
                                        {item.priceBeforeDiscount && item.priceBeforeDiscount > item.price && (
                                          <p className="text-[10px] text-gray-300 line-through">
                                            {formatCurrency(item.priceBeforeDiscount)}
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* Stats Row */}
                                    <div className="flex items-center gap-3 text-[10px]">
                                      {item.ratingAverage > 0 && (
                                        <div className="flex items-center gap-1">
                                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                          <span className="font-semibold">{Number(item.ratingAverage).toFixed(1)}</span>
                                          {item.ratingCount > 0 && (
                                            <span className="text-gray-300">({formatCount(item.ratingCount)})</span>
                                          )}
                                        </div>
                                      )}
                                      {item.commentCount > 0 && (
                                        <div className="flex items-center gap-1 text-gray-300">
                                          <MessageCircle className="w-3 h-3" />
                                          <span>{formatCount(item.commentCount)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* View Product Hint */}
                                    <div className="mt-2 pt-2 border-t border-white/20">
                                      <p className="text-[9px] text-white/80 font-medium">
                                        Cliquer pour voir →
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Interaction Bar - Taobao Style */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <Heart className="w-4 h-4 text-pink-500" />
                          <span className="font-semibold">{formatCount(shop.followersCount || 0)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-indigo-500" />
                          <span className="font-semibold">{formatCount(shop.productCount || 0)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold">{formatCount(shop.totalViews ?? Math.floor((shop.productCount || 0) * 12.5))}</span>
                        </span>
                      </div>
                      <Link
                        to={buildShopPath(shop)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm hover:shadow-md"
                      >
                        Voir boutique
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Admin Meta */}
                  {isAdmin && meta?.shopVerifiedBy && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-indigo-50/50">
                      <div className="flex items-center gap-2 text-xs text-indigo-700">
                        <User className="w-3.5 h-3.5" />
                        <span className="font-semibold">Vérifiée par {meta.shopVerifiedBy.name}</span>
                        {meta.shopVerifiedAt && (
                          <span className="text-indigo-600">
                            · {new Date(meta.shopVerifiedAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && pendingShops.length > 0 && (
          <section className="mt-10 space-y-4">
            <div>
              <p className="text-xs uppercase font-semibold text-amber-600 flex items-center gap-2">
                <Shield size={16} className="text-amber-500" />
                Boutiques en attente de vérification
              </p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">Soumissions récentes</h2>
              <p className="text-sm text-gray-500">
                Ces boutiques seront examinées prochainement par l’équipe HDMarket.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingShops.map((shop) => (
                <Link
                  key={`pending-${shop._id}`}
                  to={buildShopPath(shop)}
                  className="rounded-2xl border border-amber-100 bg-white p-4 hover:border-amber-200 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.shopLogo || '/api/placeholder/80/80'}
                      alt={shop.shopName}
                      className="w-14 h-14 rounded-2xl object-cover border border-amber-100"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{shop.shopName || shop.name}</p>
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <MapPin size={12} />
                        {shop.shopAddress || 'Adresse en cours'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{shop.productCount || 0} annonce{shop.productCount > 1 ? 's' : ''}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700 border border-amber-100">
                      En revue
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Retourner à l&apos;accueil
          </Link>
        </div>
      </div>

      {/* All Shops Modal */}
      {allShopsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
          onClick={() => {
            setAllShopsModalOpen(false);
            setAllShopsSearch('');
          }}
        >
          <div
            className="relative w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 p-6 border-b border-gray-200 bg-white rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
                  <Store size={24} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Toutes les boutiques</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {allShopsForModal.length} boutique{allShopsForModal.length > 1 ? 's' : ''} au total
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAllShopsModalOpen(false);
                  setAllShopsSearch('');
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={allShopsSearch}
                  onChange={(e) => setAllShopsSearch(e.target.value)}
                  placeholder="Rechercher une boutique par nom ou adresse..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Certified Shops Section */}
              {certifiedShopsInModal.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100">
                      <CheckCircle size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Boutiques certifiées</h3>
                      <p className="text-xs text-gray-500">
                        {certifiedShopsInModal.length} boutique{certifiedShopsInModal.length > 1 ? 's' : ''} vérifiée{certifiedShopsInModal.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {certifiedShopsInModal.map((shop) => (
                      <Link
                        key={`certified-${shop._id}`}
                        to={buildShopPath(shop)}
                        onClick={() => {
                          setAllShopsModalOpen(false);
                          setAllShopsSearch('');
                        }}
                        className="group relative rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 p-4 hover:border-emerald-200 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={shop.shopLogo || '/api/placeholder/60/60'}
                              alt={shop.shopName}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-200"
                            />
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg">
                              <CheckCircle size={12} className="text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900 truncate text-sm">
                                {shop.shopName || shop.name}
                              </p>
                              <VerifiedBadge verified showLabel={false} />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <MapPin size={12} />
                              <span className="truncate">{shop.shopAddress || 'Adresse non renseignée'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-gray-600">
                            <span className="flex items-center gap-1">
                              <ShoppingCart size={12} className="text-indigo-500" />
                              <span className="font-semibold">{formatCount(shop.productCount || 0)}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart size={12} className="text-pink-500" />
                              <span className="font-semibold">{formatCount(shop.followersCount || 0)}</span>
                            </span>
                          </div>
                          <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Non-Certified Shops Section */}
              {nonCertifiedShopsInModal.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-orange-100">
                      <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Boutiques non certifiées</h3>
                      <p className="text-xs text-gray-500">
                        {nonCertifiedShopsInModal.length} boutique{nonCertifiedShopsInModal.length > 1 ? 's' : ''} en attente de vérification
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nonCertifiedShopsInModal.map((shop) => (
                      <Link
                        key={`non-certified-${shop._id}`}
                        to={buildShopPath(shop)}
                        onClick={() => {
                          setAllShopsModalOpen(false);
                          setAllShopsSearch('');
                        }}
                        className="group relative rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/30 p-4 hover:border-amber-200 hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={shop.shopLogo || '/api/placeholder/60/60'}
                              alt={shop.shopName}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-amber-200"
                            />
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-lg">
                              <Clock size={12} className="text-white" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900 truncate text-sm">
                                {shop.shopName || shop.name}
                              </p>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                En attente
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <MapPin size={12} />
                              <span className="truncate">{shop.shopAddress || 'Adresse non renseignée'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-gray-600">
                            <span className="flex items-center gap-1">
                              <ShoppingCart size={12} className="text-indigo-500" />
                              <span className="font-semibold">{formatCount(shop.productCount || 0)}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart size={12} className="text-pink-500" />
                              <span className="font-semibold">{formatCount(shop.followersCount || 0)}</span>
                            </span>
                          </div>
                          <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State */}
              {allShopsForModal.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
                    <Search size={32} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Aucune boutique trouvée</p>
                  <p className="text-xs text-gray-500">
                    Essayez de modifier votre recherche
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
