import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MessageCircle,
  Navigation,
  Package,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  Users
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useShopProfileLoad } from '../context/ShopProfileLoadContext';
import AppLoader from '../components/AppLoader';
import NetworkFallbackCard from '../components/ui/NetworkFallbackCard';
import useIsMobile from '../hooks/useIsMobile';
import { setPendingAction } from '../utils/pendingAction';
import ShopTopHeader from '../components/shop/ShopTopHeader';
import ShopHero from '../components/shop/ShopHero';
import ShopQuickInfo from '../components/shop/ShopQuickInfo';
import ShopOpeningHoursCard from '../components/shop/ShopOpeningHoursCard';
import ShopActionsCard from '../components/shop/ShopActionsCard';
import ShopProductsSection from '../components/shop/ShopProductsSection';
import ShopAboutSection from '../components/shop/ShopAboutSection';
import ShopReviewsSection from '../components/shop/ShopReviewsSection';
import ShopNotFound from '../components/shop/ShopNotFound';
import ShopLoadingSkeleton from '../components/shop/ShopLoadingSkeleton';
import ShopBottomActions from '../components/shop/ShopBottomActions';
import {
  buildAppleDirectionsUrl,
  buildFullShopAddress,
  buildGoogleDirectionsUrl,
  buildGoogleEmbedUrl,
  buildOsmDirectionsUrl,
  buildOsmEmbedUrl,
  coerceFlag,
  formatCount,
  getOpeningSummary,
  getTimeZone,
  parseGeoPoint,
  readShopSnapshot,
  writeShopSnapshot
} from '../components/shop/shopProfileHelpers';

const formatPercentLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (parsed <= 1) return `${Math.round(parsed * 100)}%`;
  return `${Math.round(parsed)}%`;
};

const haversineDistanceKm = (from, to) => {
  if (!from || !to) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export default function ShopProfile() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const { runtime, t } = useAppSettings();
  const shopLoad = useShopProfileLoad();
  const isMobile = useIsMobile(767);

  const [activeCategory, setActiveCategory] = useState('all');
  const [promoOnly, setPromoOnly] = useState(false);
  const [productFeed, setProductFeed] = useState('all');
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [viewerLocation, setViewerLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [shopLoaderTimedOut, setShopLoaderTimedOut] = useState(false);

  const mapProvider = useMemo(() => {
    const normalized = String(runtime?.map_provider || runtime?.mapProvider || '')
      .trim()
      .toLowerCase();
    return normalized === 'google' ? 'google' : 'osm';
  }, [runtime?.map_provider, runtime?.mapProvider]);

  useEffect(() => {
    if (!shopLoad) return;
    shopLoad.setShopLogo?.('');
    shopLoad.setShopName?.('');
    shopLoad.setShopProfileLoading?.(true);
  }, [shopLoad, slug]);

  const shopQuery = useQuery({
    queryKey: ['shop-profile', slug],
    enabled: Boolean(slug),
    initialData: () => readShopSnapshot(slug),
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const pageLimit = 50;
      const maxPagesToLoad = 100;
      const requestOptions = {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      };

      const { data: firstPageData } = await api.get(`/shops/${slug}`, {
        ...requestOptions,
        params: { page: 1, limit: pageLimit }
      });

      const totalPages = Math.max(1, Number(firstPageData?.pagination?.pages) || 1);
      const pagesToLoad = Math.min(totalPages, maxPagesToLoad);
      const allProducts = Array.isArray(firstPageData?.products) ? [...firstPageData.products] : [];

      for (let page = 2; page <= pagesToLoad; page += 1) {
        const { data: pageData } = await api.get(`/shops/${slug}`, {
          ...requestOptions,
          params: { page, limit: pageLimit }
        });
        if (Array.isArray(pageData?.products) && pageData.products.length) {
          allProducts.push(...pageData.products);
        }
      }

      const seenProductIds = new Set();
      const mergedProducts = allProducts.filter((product) => {
        const key = String(product?._id || '');
        if (!key || seenProductIds.has(key)) return false;
        seenProductIds.add(key);
        return true;
      });

      const mergedData = {
        ...firstPageData,
        products: mergedProducts,
        pagination: {
          ...(firstPageData?.pagination || {}),
          page: 1,
          limit: pageLimit,
          pages: totalPages,
          loadedPages: pagesToLoad
        }
      };

      writeShopSnapshot(slug, mergedData);
      return mergedData;
    }
  });

  const shop = shopQuery.data?.shop || null;
  const products = useMemo(
    () => (Array.isArray(shopQuery.data?.products) ? shopQuery.data.products : []),
    [shopQuery.data?.products]
  );
  const recentReviews = useMemo(
    () => (Array.isArray(shopQuery.data?.recentReviews) ? shopQuery.data.recentReviews : []),
    [shopQuery.data?.recentReviews]
  );

  useEffect(() => {
    if (!shopLoad) return;
    const loading = Boolean(shopQuery.isLoading || shopQuery.isFetching) && !shop;
    shopLoad.setShopProfileLoading?.(loading);
  }, [shop, shopLoad, shopQuery.isFetching, shopQuery.isLoading]);

  useEffect(() => {
    if (!shopLoad || !shop) return;
    shopLoad.setShopLogo?.(shop.shopLogo || '');
    shopLoad.setShopName?.(shop.shopName || '');
  }, [shop?.shopLogo, shop?.shopName, shop, shopLoad]);

  useEffect(
    () => () => {
      shopLoad?.setShopProfileLoading?.(false);
    },
    [shopLoad]
  );

  useEffect(() => {
    const canonicalSlug = String(shop?.slug || '').trim();
    const routeSlug = String(slug || '').trim();
    const looksLikeObjectId = /^[a-f0-9]{24}$/i.test(routeSlug);
    if (!looksLikeObjectId || !canonicalSlug || canonicalSlug === routeSlug) return;
    navigate(`/shop/${canonicalSlug}`, { replace: true });
  }, [navigate, shop?.slug, slug]);

  const shopIdentifier = shop?.slug || shop?._id || slug;
  const userScopeId = user?._id || user?.id;

  const userReviewQuery = useQuery({
    queryKey: ['shop-user-review', shopIdentifier, userScopeId],
    enabled: Boolean(shopIdentifier && userScopeId),
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/shops/${shopIdentifier}/reviews/user`, {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return data;
    }
  });

  const allCommentsQuery = useQuery({
    queryKey: ['shop-reviews', shopIdentifier, 'all'],
    enabled: Boolean(showCommentsModal && shopIdentifier),
    staleTime: 20 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/shops/${shopIdentifier}/reviews`, {
        params: { page: 1, limit: 50 },
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return Array.isArray(data?.reviews) ? data.reviews : [];
    }
  });

  const currentUserReview = userReviewQuery.data || null;

  useEffect(() => {
    if (currentUserReview) {
      setReviewForm({
        rating: Number(currentUserReview.rating || 0),
        comment: currentUserReview.comment || ''
      });
      setIsEditingReview(!Boolean(currentUserReview.comment?.trim()));
      return;
    }
    setReviewForm({ rating: 0, comment: '' });
    setIsEditingReview(true);
  }, [currentUserReview?._id, currentUserReview?.rating, currentUserReview?.comment]);

  useEffect(() => {
    setActiveCategory('all');
    setPromoOnly(false);
    setProductFeed('all');
    setReviewSuccess('');
    setReviewError('');
  }, [slug]);

  useEffect(() => {
    if (!shop) return;
    const params = new URLSearchParams(location.search);
    const reviewId = String(params.get('reviewId') || '').trim();
    const rawTarget = String(params.get('section') || location.hash || '').trim().toLowerCase();
    const targetId = rawTarget.replace(/^#/, '');
    if (!targetId && !reviewId) return;

    if (targetId === 'reviews' || reviewId) {
      const reviewsNode = document.getElementById('reviews');
      if (reviewsNode) {
        setTimeout(() => {
          reviewsNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    }
  }, [location.hash, location.search, shop]);

  const categories = useMemo(() => {
    const seen = new Set();
    return products.reduce((acc, product) => {
      const category = String(product?.category || '').trim();
      if (!category || seen.has(category)) return acc;
      seen.add(category);
      acc.push(category);
      return acc;
    }, []);
  }, [products]);

  const categoryCounts = useMemo(
    () =>
      products.reduce((acc, product) => {
        const category = String(product?.category || '').trim();
        if (!category) return acc;
        acc[category] = Number(acc[category] || 0) + 1;
        return acc;
      }, {}),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const byCategory =
      activeCategory === 'all'
        ? products
        : products.filter((product) => String(product?.category || '').trim() === activeCategory);
    if (!promoOnly) return byCategory;
    return byCategory.filter((product) => Boolean(product?.hasActivePromo));
  }, [activeCategory, promoOnly, products]);

  const topSellingProducts = useMemo(
    () =>
      [...products]
        .filter((product) => Number(product?.salesCount || 0) > 0)
        .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
        .slice(0, 6),
    [products]
  );

  const featuredProducts = useMemo(
    () =>
      filteredProducts.filter((product) =>
        Boolean(
          product?.isFeatured ||
            product?.featured ||
            product?.boosted ||
            product?.isBoosted ||
            product?.boostActive
        )
      ),
    [filteredProducts]
  );

  const latestProducts = useMemo(
    () =>
      [...filteredProducts]
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
        .slice(0, 24),
    [filteredProducts]
  );

  const hasPromoProducts = useMemo(
    () => products.some((product) => Boolean(product?.hasActivePromo)),
    [products]
  );

  const displayProducts = useMemo(() => {
    if (productFeed === 'featured') return featuredProducts;
    if (productFeed === 'latest') return latestProducts;
    if (productFeed === 'popular') return topSellingProducts;
    return filteredProducts;
  }, [featuredProducts, filteredProducts, latestProducts, productFeed, topSellingProducts]);

  const isFollowing = useMemo(() => {
    if (!shop?._id || !Array.isArray(user?.followingShops)) return false;
    return user.followingShops.some((entry) => String(entry) === String(shop._id));
  }, [shop?._id, user?.followingShops]);

  const viewerUserId = user?._id || user?.id || null;
  const isOwnShop = useMemo(
    () => Boolean(viewerUserId && shop?._id && String(viewerUserId) === String(shop._id)),
    [shop?._id, viewerUserId]
  );

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!shop?._id) throw new Error('Boutique introuvable.');
      if (isFollowing) {
        const { data } = await api.delete(`/users/shops/${shop._id}/follow`);
        return data;
      }
      const { data } = await api.post(`/users/shops/${shop._id}/follow`);
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['shop-profile', slug] });
      const previous = queryClient.getQueryData(['shop-profile', slug]);
      queryClient.setQueryData(['shop-profile', slug], (old) => {
        if (!old?.shop) return old;
        const currentFollowers = Number(old.shop.followersCount || 0);
        const nextFollowers = isFollowing
          ? Math.max(0, currentFollowers - 1)
          : currentFollowers + 1;
        return {
          ...old,
          shop: {
            ...old.shop,
            followersCount: nextFollowers
          }
        };
      });
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['shop-profile', slug], context.previous);
      showToast(
        err?.response?.data?.message || err?.message || t('shop_profile.follow_error', 'Impossible de suivre cette boutique.'),
        { variant: 'error' }
      );
    },
    onSuccess: (data) => {
      if (typeof updateUser === 'function' && shop?._id) {
        const current = Array.isArray(user?.followingShops)
          ? user.followingShops.map((entry) => String(entry))
          : [];
        const next = isFollowing
          ? current.filter((entry) => entry !== String(shop._id))
          : Array.from(new Set([...current, String(shop._id)]));
        updateUser({ followingShops: next });
      }
      queryClient.setQueryData(['shop-profile', slug], (old) => {
        if (!old?.shop) return old;
        return {
          ...old,
          shop: {
            ...old.shop,
            followersCount: Number(data?.followersCount ?? old.shop.followersCount ?? 0)
          }
        };
      });
      showToast(
        data?.message ||
          (isFollowing
            ? t('shop_profile.unfollowed', 'Boutique désabonnée.')
            : t('shop_profile.followed', 'Boutique suivie.')),
        { variant: 'success' }
      );
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ rating, comment }) => {
      const { data } = await api.post(`/shops/${shopIdentifier}/reviews`, { rating, comment });
      return data;
    },
    onSuccess: (data) => {
      setReviewSuccess(t('shop_profile.review_saved', 'Votre avis a été enregistré.'));
      setReviewError('');
      setIsEditingReview(!Boolean(data?.comment?.trim()));
      queryClient.setQueryData(['shop-user-review', shopIdentifier, userScopeId], data);
      queryClient.invalidateQueries({ queryKey: ['shop-profile', slug] });
      queryClient.invalidateQueries({ queryKey: ['shop-reviews', shopIdentifier] });
    },
    onError: (err) => {
      setReviewSuccess('');
      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          t('shop_profile.review_error', "Impossible d'enregistrer votre avis pour l'instant.")
      );
    }
  });

  const goToMessage = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    const firstProduct = products[0];
    if (firstProduct?._id) {
      navigate('/orders/messages', { state: { inquireProduct: firstProduct } });
      return;
    }
    navigate('/orders/messages');
  }, [navigate, products, slug, user]);

  const shopLocation = useMemo(
    () => parseGeoPoint(shop?.location || shop?.shopLocation),
    [shop?.location, shop?.shopLocation]
  );
  const googleDirectionsUrl = useMemo(
    () => buildGoogleDirectionsUrl({ destination: shopLocation, origin: viewerLocation }),
    [shopLocation, viewerLocation]
  );
  const osmDirectionsUrl = useMemo(
    () => buildOsmDirectionsUrl({ destination: shopLocation, origin: viewerLocation }),
    [shopLocation, viewerLocation]
  );
  const appleDirectionsUrl = useMemo(
    () => buildAppleDirectionsUrl({ destination: shopLocation }),
    [shopLocation]
  );
  const osmEmbedUrl = useMemo(() => buildOsmEmbedUrl(shopLocation), [shopLocation]);
  const googleEmbedUrl = useMemo(() => buildGoogleEmbedUrl(shopLocation), [shopLocation]);
  const activeDirectionsUrl = useMemo(
    () => (mapProvider === 'google' ? googleDirectionsUrl : osmDirectionsUrl),
    [googleDirectionsUrl, mapProvider, osmDirectionsUrl]
  );
  const activeEmbedUrl = useMemo(
    () => (mapProvider === 'google' ? googleEmbedUrl : osmEmbedUrl),
    [googleEmbedUrl, mapProvider, osmEmbedUrl]
  );

  const requestViewerLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDistanceError(t('shop_profile.geo_unavailable', 'Géolocalisation indisponible sur cet appareil.'));
      return;
    }
    setDistanceLoading(true);
    setDistanceError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setDistanceError(t('shop_profile.geo_invalid', 'Position actuelle invalide.'));
          setDistanceLoading(false);
          return;
        }
        setViewerLocation({ latitude, longitude });
        setDistanceLoading(false);
      },
      (error) => {
        const code = Number(error?.code || 0);
        const message =
          code === 1
            ? t('shop_profile.geo_denied', 'Permission de localisation refusée.')
            : code === 2
              ? t('shop_profile.geo_unavailable', 'Position indisponible.')
              : code === 3
                ? t('shop_profile.geo_timeout', 'Temps de localisation dépassé.')
                : t('shop_profile.geo_error', 'Impossible de récupérer votre position.');
        setDistanceError(message);
        setDistanceLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [t]);

  useEffect(() => {
    if (!shopLocation || !viewerLocation) {
      setDistanceKm(null);
      return;
    }
    const computedDistance = haversineDistanceKm(viewerLocation, shopLocation);
    setDistanceKm(Number.isFinite(computedDistance) ? computedDistance : null);
  }, [shopLocation, viewerLocation]);

  const handleDirections = useCallback(() => {
    const fallbackUrl =
      mapProvider === 'google'
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            shop?.shopAddress || shop?.shopName || 'HDMarket'
          )}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(
            shop?.shopAddress || shop?.shopName || 'HDMarket'
          )}`;
    const url = activeDirectionsUrl || fallbackUrl;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  }, [activeDirectionsUrl, mapProvider, shop?.shopAddress, shop?.shopName]);

  const handleShareShop = useCallback(async () => {
    const title = shop?.shopName || 'HDMarket';
    const text = t('shop_profile.share_text', `Découvrez ${title} sur HDMarket`);
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://hdmarket.app/shop/${slug}`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(t('shop_profile.link_copied', 'Lien boutique copié.'), { variant: 'success' });
        return;
      }
      showToast(t('shop_profile.share_unavailable', 'Partage indisponible sur cet appareil.'), {
        variant: 'info'
      });
    } catch {
      // ignore share cancel
    }
  }, [shop?.shopName, showToast, slug, t]);

  const handlePrimaryAction = useCallback(() => {
    if (isOwnShop) {
      navigate('/profile');
      return;
    }
    const node = document.getElementById('products');
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isOwnShop, navigate]);

  const shopVerifiedFlag =
    coerceFlag(shop?.shopVerified) ||
    coerceFlag(shop?.verified) ||
    coerceFlag(shop?.isVerified) ||
    coerceFlag(shop?.verificationStatus);
  const hasVerifiedSellerInProducts = useMemo(
    () =>
      products.some((product) =>
        coerceFlag(
          product?.user?.shopVerified ??
            product?.shopVerified ??
            product?.verified ??
            product?.isVerified
        )
      ),
    [products]
  );
  const isCertifiedShop = shopVerifiedFlag || hasVerifiedSellerInProducts;

  const handleFollowToggle = useCallback(() => {
    if (followMutation.isPending) return;
    if (!shop?._id) {
      showToast(t('shop_profile.loading_retry', 'Chargement de la boutique en cours. Réessayez dans un instant.'), {
        variant: 'info'
      });
      shopQuery.refetch();
      return;
    }
    if (!user?.token) {
      setPendingAction({ type: 'followShop', payload: { shopId: shop._id } });
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    if (isOwnShop) {
      showToast(t('shop_profile.follow_own_shop', 'Vous ne pouvez pas suivre votre propre boutique.'), {
        variant: 'info'
      });
      return;
    }
    if (!shopVerifiedFlag) {
      showToast(t('shop_profile.only_verified_follow', 'Seules les boutiques certifiées peuvent être suivies.'), {
        variant: 'info'
      });
      return;
    }
    followMutation.mutate();
  }, [
    followMutation,
    isOwnShop,
    navigate,
    shop?._id,
    shopQuery,
    shopVerifiedFlag,
    showToast,
    slug,
    t,
    user?.token
  ]);

  const handleSubmitReview = useCallback(
    (event) => {
      event.preventDefault();
      if (!user) {
        navigate('/login', { state: { from: `/shop/${slug}` } });
        return;
      }
      const rating = Number(reviewForm.rating || 0);
      const comment = String(reviewForm.comment || '').trim();
      if (!rating && !comment) {
        setReviewError(t('shop_profile.review_require_input', 'Ajoutez une note ou un commentaire pour continuer.'));
        return;
      }
      reviewMutation.mutate({ rating, comment });
    },
    [navigate, reviewForm.comment, reviewForm.rating, reviewMutation, slug, t, user]
  );

  const ratingAverage = Number(shop?.ratingAverage || 0);
  const ratingCount = Number(shop?.ratingCount || 0);
  const followersCount = Number(shop?.followersCount || 0);
  const shopTimeZone = useMemo(() => getTimeZone(), []);
  const openingSummary = useMemo(
    () => getOpeningSummary(shop?.shopHours || [], shopTimeZone),
    [shop?.shopHours, shopTimeZone]
  );
  const hasActivePromo = Boolean(shop?.hasActivePromo && Number(shop?.activePromoCountNow || 0) > 0);
  const hasFreeDelivery = Boolean(shop?.freeDeliveryEnabled);
  const completedOrders = useMemo(
    () =>
      products.reduce((total, product) => {
        const count = Number(product?.salesCount || 0);
        return total + (Number.isFinite(count) && count > 0 ? count : 0);
      }, 0),
    [products]
  );
  const yearsActiveLabel = useMemo(() => {
    if (!shop?.createdAt) return t('shop_profile.new', 'Nouveau');
    const createdAt = new Date(shop.createdAt);
    if (Number.isNaN(createdAt.getTime())) return t('shop_profile.new', 'Nouveau');
    const today = new Date();
    const yearDiff = today.getFullYear() - createdAt.getFullYear();
    if (yearDiff <= 0) return t('shop_profile.new', 'Nouveau');
    return `${yearDiff} ${yearDiff > 1 ? t('shop_profile.years', 'ans') : t('shop_profile.year', 'an')}`;
  }, [shop?.createdAt, t]);
  const customerSatisfaction =
    ratingCount > 0
      ? `${Math.round((ratingAverage / 5) * 100)}%`
      : t('shop_profile.new', 'Nouveau');
  const responseRateLabel = useMemo(
    () => formatPercentLabel(shop?.responseRate ?? shop?.replyRate ?? shop?.messageResponseRate),
    [shop?.messageResponseRate, shop?.replyRate, shop?.responseRate]
  );
  const responseTimeLabel = useMemo(() => {
    const raw =
      shop?.responseTimeLabel ||
      shop?.responseTime ||
      shop?.avgResponseTime ||
      shop?.averageResponseTime;
    if (!raw) return null;
    return String(raw);
  }, [shop?.averageResponseTime, shop?.avgResponseTime, shop?.responseTime, shop?.responseTimeLabel]);
  const shopCategoryLabel = String(shop?.shopCategory || shop?.category || '').trim();

  const deliveryAvailableLabel = hasFreeDelivery
    ? t('shop_profile.free_delivery', 'Livraison gratuite')
    : products.some((product) => product?.deliveryAvailable !== false)
      ? t('shop_profile.delivery_available', 'Livraison disponible')
      : null;
  const pickupAvailableLabel = products.some((product) => product?.pickupAvailable !== false)
    ? t('shop_profile.pickup_available', 'Retrait en boutique')
    : null;

  const trustQuickInfo = [
    {
      id: 'verification',
      icon: <ShieldCheck size={14} className="text-emerald-600" />,
      label: t('shop_profile.badge_shop', 'Boutique'),
      value: isCertifiedShop ? t('shop_profile.verified', 'Vérifiée') : t('shop_profile.standard', 'Standard')
    },
    responseRateLabel
      ? {
          id: 'response-rate',
          icon: <MessageCircle size={14} className="text-blue-600" />,
          label: t('shop_profile.response_rate', 'Taux réponse'),
          value: responseRateLabel
        }
      : null,
    responseTimeLabel
      ? {
          id: 'response-time',
          icon: <Clock size={14} className="text-violet-600" />,
          label: t('shop_profile.response_time', 'Temps réponse'),
          value: responseTimeLabel
        }
      : null,
    deliveryAvailableLabel
      ? {
          id: 'delivery',
          icon: <Navigation size={14} className="text-indigo-600" />,
          label: t('shop_profile.delivery', 'Livraison'),
          value: deliveryAvailableLabel
        }
      : null,
    pickupAvailableLabel
      ? {
          id: 'pickup',
          icon: <Store size={14} className="text-slate-600" />,
          label: t('shop_profile.pickup', 'Retrait'),
          value: pickupAvailableLabel
        }
      : null,
    shopCategoryLabel
      ? {
          id: 'category',
          icon: <Package size={14} className="text-amber-600" />,
          label: t('shop_profile.category', 'Catégorie'),
          value: shopCategoryLabel
        }
      : null,
    {
      id: 'seniority',
      icon: <Calendar size={14} className="text-slate-600" />,
      label: t('shop_profile.seniority', 'Ancienneté'),
      value: yearsActiveLabel
    }
  ].filter(Boolean);

  const shopFullAddress = useMemo(() => buildFullShopAddress(shop), [shop]);
  const phoneLabel = user && shop?.phone
    ? shop.phone
    : t('shop_profile.show_phone', 'Connectez-vous pour afficher le numéro');

  const stats = [
    {
      icon: <Package size={16} className="text-neutral-600" />,
      label: t('shop_profile.products_count', 'Produits'),
      value: formatCount(shop?.productCount ?? products.length)
    },
    {
      icon: <TrendingUp size={16} className="text-indigo-600" />,
      label: t('shop_profile.orders', 'Commandes'),
      value: formatCount(completedOrders)
    },
    {
      icon: <Star size={16} className="text-amber-500" />,
      label: t('shop_profile.reviews_count', 'Avis'),
      value: formatCount(ratingCount)
    },
    {
      icon: <Users size={16} className="text-sky-600" />,
      label: t('shop_profile.followers', 'Abonnés'),
      value: formatCount(followersCount)
    }
  ];

  const followDisabled = followMutation.isPending || !shop?._id || !shopVerifiedFlag || isOwnShop;

  const isOfflineSnapshot = shopQuery.isError && Boolean(shopQuery.data);
  const isNetworkErrorWithoutResponse = Boolean(shopQuery.isError && !shop && !shopQuery.error?.response);
  const statusCode = Number(shopQuery.error?.response?.status || 0);

  useEffect(() => {
    if (shop) {
      setShopLoaderTimedOut(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setShopLoaderTimedOut(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [shop, slug]);

  if (!shop && statusCode === 404) {
    return <ShopNotFound t={t} />;
  }

  if (!shop) {
    return (
      <>
        <ShopLoadingSkeleton />
        {shopQuery.isError && shopQuery.error?.response && (
          <div className="mx-auto max-w-7xl px-4 pb-4">
            <NetworkFallbackCard
              title={t('shop_profile.load_error', 'Impossible de charger la boutique')}
              message={shopQuery.error?.response?.data?.message || t('shop_profile.network_retry', 'Réessayez dans un instant.')}
              onRetry={() => {
                setShopLoaderTimedOut(false);
                shopQuery.refetch();
              }}
              retryLabel={t('common.retry', 'Réessayer')}
              refreshLabel={t('common.refresh', 'Actualiser')}
            />
          </div>
        )}
        <AppLoader
          visible
          label="HDMarket"
          timedOut={shopLoaderTimedOut || isNetworkErrorWithoutResponse || Boolean(shopQuery.isError)}
          onRetry={() => {
            setShopLoaderTimedOut(false);
            shopQuery.refetch();
          }}
        />
      </>
    );
  }

  return (
    <main
      className={`w-full max-w-full overflow-x-clip [overflow-wrap:anywhere] bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 ${
        isMobile ? 'pb-36' : 'pb-12'
      }`}
    >
      <div className="mx-auto w-full max-w-7xl min-w-0 overflow-x-clip px-4 py-4 max-[640px]:max-w-[430px] sm:px-6 lg:px-8">
        <ShopTopHeader
          title={shop.shopName}
          subtitle={[shop?.commune, shop?.city].filter(Boolean).join(', ') || t('shop_profile.public_shop', 'Boutique publique')}
          onBack={() => navigate(-1)}
          onShare={handleShareShop}
          onFollowToggle={handleFollowToggle}
          isFollowing={isFollowing}
          followDisabled={followDisabled}
          t={t}
        />

        {isOfflineSnapshot && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            {t(
              'shop_profile.offline_snapshot',
              'Vous consultez une version hors ligne récente de cette boutique.'
            )}
          </div>
        )}

        <div className="min-w-0 space-y-4">
          <ShopHero
            shop={shop}
            isCertifiedShop={isCertifiedShop}
            openingSummary={openingSummary}
            ratingAverage={ratingAverage}
            ratingCount={ratingCount}
            stats={stats}
            hasActivePromo={hasActivePromo}
            hasFreeDelivery={hasFreeDelivery}
            yearsActiveLabel={yearsActiveLabel}
            customerSatisfaction={customerSatisfaction}
            t={t}
          />

          <ShopQuickInfo openingSummary={openingSummary} trustQuickInfo={trustQuickInfo} t={t} />

          <div className="grid min-w-0 gap-4 overflow-x-clip lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4 overflow-x-clip">
              {isMobile && (
                <ShopOpeningHoursCard
                  openingSummary={openingSummary}
                  isCertifiedShop={isCertifiedShop}
                  t={t}
                />
              )}

              <ShopActionsCard
                isOwnShop={isOwnShop}
                slug={slug}
                user={user}
                shopPhone={shop.phone}
                isCertifiedShop={isCertifiedShop}
                isFollowing={isFollowing}
                followDisabled={followDisabled}
                followPending={followMutation.isPending}
                onPrimaryAction={handlePrimaryAction}
                onShare={handleShareShop}
                onMessage={goToMessage}
                onDirections={handleDirections}
                onFollowToggle={handleFollowToggle}
                t={t}
              />

              <ShopProductsSection
                products={products}
                categories={categories}
                categoryCounts={categoryCounts}
                activeCategory={activeCategory}
                setActiveCategory={setActiveCategory}
                promoOnly={promoOnly}
                setPromoOnly={setPromoOnly}
                hasPromoProducts={hasPromoProducts}
                displayProducts={displayProducts}
                productFeed={productFeed}
                setProductFeed={setProductFeed}
                featuredProducts={featuredProducts}
                latestProducts={latestProducts}
                topSellingProducts={topSellingProducts}
                loading={shopQuery.isLoading}
                useCompactCards={isMobile}
                t={t}
                onGoReviews={() => {
                  const node = document.getElementById('reviews');
                  if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />

              <ShopAboutSection
                shop={shop}
                isCertifiedShop={isCertifiedShop}
                shopCategoryLabel={shopCategoryLabel}
                shopFullAddress={shopFullAddress}
                phoneLabel={phoneLabel}
                shopLocation={shopLocation}
                activeEmbedUrl={activeEmbedUrl}
                activeDirectionsUrl={activeDirectionsUrl}
                appleDirectionsUrl={appleDirectionsUrl}
                mapProvider={mapProvider}
                onRequestLocation={requestViewerLocation}
                distanceLoading={distanceLoading}
                distanceKm={distanceKm}
                distanceError={distanceError}
                t={t}
              />

              <ShopReviewsSection
                ratingCount={ratingCount}
                ratingAverage={ratingAverage}
                recentReviews={recentReviews}
                userScopeId={userScopeId}
                currentUserReview={currentUserReview}
                showReviewForm={!Boolean(currentUserReview?.comment?.trim()) || isEditingReview}
                setIsEditingReview={setIsEditingReview}
                reviewForm={reviewForm}
                setReviewForm={setReviewForm}
                reviewSuccess={reviewSuccess}
                reviewError={reviewError}
                onSubmitReview={handleSubmitReview}
                reviewPending={reviewMutation.isPending}
                user={user}
                showCommentsModal={showCommentsModal}
                setShowCommentsModal={setShowCommentsModal}
                allCommentsQuery={allCommentsQuery}
                t={t}
              />
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-4">
                <ShopOpeningHoursCard
                  openingSummary={openingSummary}
                  isCertifiedShop={isCertifiedShop}
                  t={t}
                />
                <ShopActionsCard
                  isOwnShop={isOwnShop}
                  slug={slug}
                  user={user}
                  shopPhone={shop.phone}
                  isCertifiedShop={isCertifiedShop}
                  isFollowing={isFollowing}
                  followDisabled={followDisabled}
                  followPending={followMutation.isPending}
                  onPrimaryAction={handlePrimaryAction}
                  onShare={handleShareShop}
                  onMessage={goToMessage}
                  onDirections={handleDirections}
                  onFollowToggle={handleFollowToggle}
                  t={t}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {isMobile && (
        <ShopBottomActions
          slug={slug}
          user={user}
          shopPhone={shop.phone}
          onMessage={goToMessage}
          onDirections={handleDirections}
          onShare={handleShareShop}
          onPrimaryAction={handlePrimaryAction}
          onFollowToggle={handleFollowToggle}
          isFollowing={isFollowing}
          followDisabled={followDisabled}
          t={t}
        />
      )}
    </main>
  );
}
