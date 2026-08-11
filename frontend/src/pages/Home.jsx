import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { isApiCanceledError } from "../services/api";
import ProductCard from "../components/ProductCard";
import FlashSaleCard from "../components/FlashSaleCard";
import PreviewableImage from "../components/media/PreviewableImage";
import NetworkFallbackCard from "../components/ui/NetworkFallbackCard";
import ShimmerSkeleton from "../components/ui/ShimmerSkeleton";
import GroupBuyHomeSection from "../components/GroupBuyHomeSection";
import useCategories from '../hooks/useCategories';
import { Search, Star, Zap, Shield, Truck, Award, Heart, ChevronRight, Tag, Sparkles, RefreshCcw, MapPin, LayoutGrid, Clock, X, ShoppingBag, User, Flame, Store, CreditCard, Users, Package, Play, Clapperboard, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import { buildProductPath, buildShopPath } from "../utils/links";
import AuthContext from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import BaseModal, { ModalBody, ModalHeader } from "../components/modals/BaseModal";
import useNetworkProfile from "../hooks/useNetworkProfile";
import { loadOfflineSnapshot, saveOfflineSnapshot } from "../utils/offlineSnapshots";
import { readRouteViewCache, writeRouteViewCache } from "../utils/routeViewCache";
import { subscribeToSettingsRefresh } from '../utils/settingsRefresh';
import {
  filterActiveInstallmentProducts,
  getInstallmentFirstPaymentAmount,
  isInstallmentOfferActive
} from '../utils/installmentAvailability';

const normalizeCityName = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

// Deterministic (seeded) Fisher-Yates shuffle — same seed always produces the
// same order, so a stable per-mount seed gives "random on each page load"
// without the selection jumping around on every unrelated re-render.
const seededShuffle = (list, seed) => {
  let state = seed || 1;
  const nextRandom = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const normalizeSettingBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const resolveProductCity = (product) => {
  if (!product || typeof product !== 'object') return '';
  const rawCity =
    product.city ||
    product.deliveryCity ||
    product?.user?.city ||
    product?.user?.preferredCity ||
    '';
  return typeof rawCity === 'string' ? rawCity.trim() : '';
};

const resolveProductImageSet = (product) => {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  if (images.length) return images;
  if (product?.image) return [product.image];
  return ['/api/placeholder/400/400'];
};

const resolveProductPrimaryImage = (product) => resolveProductImageSet(product)[0];

const buildImageReportContext = (product, deepLink = '') => {
  const seller = product?.user && typeof product.user === 'object' ? product.user : null;
  const shopId = seller?._id || (typeof product?.user === 'string' ? product.user : '');
  return {
    contextType: 'product',
    productId: product?._id || '',
    productSlug: product?.slug || '',
    productTitle: product?.title || '',
    shopId: shopId || '',
    shopSlug: seller?.slug || '',
    shopName: seller?.shopName || seller?.name || '',
    deepLink: deepLink || buildProductPath(product)
  };
};

// Scroll-triggered entrance shared by home sections.
const scrollReveal = (reduceMotion) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-40px' },
        transition: { duration: 0.4, ease: 'easeOut' }
      };

const FeaturedTagSections = ({ t }) => {
  const [sections, setSections] = useState([]);

  useEffect(() => {
    let active = true;
    api.get('/tags/featured/sections', { params: { limit: 6, productsPerTag: 6 } })
      .then(({ data }) => {
        if (active) setSections(Array.isArray(data) ? data.filter((section) => section?.products?.length) : []);
      })
      .catch(() => {
        if (active) setSections([]);
      });
    return () => { active = false; };
  }, []);

  if (!sections.length) return null;
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 py-8 sm:px-4 lg:px-8">
      {sections.map(({ tag, products }) => (
        <section key={tag._id} className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: tag.color || '#E85D00' }}>
                {tag.type === 'campaign' ? t('home.campaign', 'Campagne') : t('home.tagCollection', 'Collection')}
              </p>
              <h2 className="mt-1 text-xl font-black text-neutral-950 sm:text-2xl">{tag.homepageTitle || tag.name}</h2>
            </div>
            <Link to={`/search?tags=${encodeURIComponent(tag.slug)}`} className="inline-flex items-center gap-1 text-xs font-black text-orange-600">
              {t('home.viewAll', 'Voir tout')} <ChevronRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product._id} p={product} productLink={buildProductPath(product)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

// Time-of-day greeting info: Bonjour until 18h, Bonsoir from 18h to 5h.
const getGreetingInfo = (user) => {
  if (!user?.name) return null;
  const hour = new Date().getHours();
  return {
    isEvening: hour >= 18 || hour < 5,
    firstName: String(user.name).trim().split(/\s+/)[0],
    dateLabel: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  };
};

// Mobile greeting stays focused on the welcome message. The delivery address
// already appears beside the app name in the header above.
const HomeGreeting = ({ user }) => {
  const info = getGreetingInfo(user);
  if (!info) return null;
  const { isEvening, firstName, dateLabel } = info;
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF6A00] to-[#e85d00] shadow-sm">
      <div className="relative px-4 pb-2.5 pt-3">
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-10 h-20 w-20 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm">
            {isEvening ? <Moon size={18} /> : <Sun size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black leading-tight text-white">
              {isEvening ? 'Bonsoir' : 'Bonjour'} {firstName} 👋
            </p>
            <p className="truncate text-[11px] font-medium capitalize text-white/80">
              {dateLabel} · {isEvening ? 'offres du soir' : 'offres du jour'}
            </p>
          </div>
          <Sparkles size={18} className="shrink-0 text-white/70" />
        </div>
      </div>
    </div>
  );
};

const PourVousSection = ({ user, t, formatPrice, buildProductLink, externalLinkProps }) => {
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState(false);

  useEffect(() => {
    if (!user) {
      setRecommendedProducts([]);
      setRecsLoading(false);
      setRecsError(false);
      return undefined;
    }

    let cancelled = false;
    setRecsLoading(true);
    setRecsError(false);

    api.get('/products/recommendations', { params: { page: 1, limit: 8 }, skipCache: false })
      .then(({ data }) => {
        if (!cancelled) setRecommendedProducts(data?.items || []);
      })
      .catch(() => {
        if (!cancelled) setRecsError(true);
      })
      .finally(() => {
        if (!cancelled) setRecsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || recsLoading || (!recsError && recommendedProducts.length === 0)) return null;

  return (
    <section aria-labelledby="pour-vous-title" className="min-w-0">
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="pour-vous-title" className="text-[17px] font-black tracking-[-0.01em] text-[#231f1b]">
            {t('home.pourVous', 'Pour vous')}
          </h2>
          <p className="mt-0.5 truncate text-[11px] font-medium text-[#8a8378]">
            {t('home.pourVousSubtitle', 'Recommandations basées sur vos goûts')}
          </p>
        </div>
        <Link
          to="/suggestions"
          {...externalLinkProps}
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[13px] font-bold text-[#e85d00] transition-colors active:text-[#c2410c]"
        >
          {t('home.viewAll', 'Voir tout')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {recsError ? (
        <p className="rounded-xl border border-[#eee8e0] bg-white px-3 py-4 text-center text-xs text-[#8a8378]">
          {t('home.recsError', 'Indisponible. Revenez plus tard.')}
        </p>
      ) : (
        <div
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {recommendedProducts.map((product, index) => (
            <Link
              key={`pourvous-${product._id || index}`}
              to={buildProductLink(product)}
              {...externalLinkProps}
              className="w-[138px] shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#eee8e0] bg-white shadow-sm transition-transform active:scale-[0.98]"
            >
              <div className="aspect-square overflow-hidden bg-[#f3f0ec]">
                <PreviewableImage
                  product={product}
                  src={resolveProductPrimaryImage(product)}
                  images={resolveProductImageSet(product)}
                  alt={product.title || t('home.product', 'Produit')}
                  className="h-full w-full object-cover"
                  loading={index < 3 ? 'eager' : 'lazy'}
                  reportContext={buildImageReportContext(product, buildProductLink(product))}
                  showHint={false}
                />
              </div>
              <div className="p-2.5">
                <p className="truncate text-[12px] font-semibold text-[#6b6459]">{product.title}</p>
                <p className="mt-1 truncate text-[15px] font-black text-[#231f1b]">
                  {formatPrice(product.price || 0)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

const ProductVideosHomeSection = ({ enabled }) => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setVideos([]);
      return undefined;
    }
    let active = true;
    api.get('/product-videos/feed', { params: { limit: 6, filter: 'trending' }, silentGlobalError: true })
      .then(({ data }) => active && setVideos(data?.items || []))
      .catch(() => active && setVideos([]));
    return () => { active = false; };
  }, [enabled]);

  if (!enabled || !videos.length) return null;
  return (
    <section className="order-[-9]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-neutral-950 text-white"><Clapperboard size={16} /></span>
          <div><h2 className="text-[18px] font-black tracking-[-0.02em]">HDMarket Videos</h2><p className="text-[10px] font-semibold text-neutral-500">Découvrez, regardez, achetez</p></div>
        </div>
        <Link to="/videos" className="flex items-center text-xs font-semibold text-neutral-950">Voir tout <ChevronRight size={14} /></Link>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4">
        {videos.map((video) => (
          <Link key={video._id} to={`/videos?video=${video._id}`} className="group relative aspect-[3/4] w-[142px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-neutral-950 text-white shadow-sm">
            <img src={video.thumbnailUrl || video.product?.images?.[0]} alt={video.product?.title || ''} loading="lazy" className="h-full w-full object-cover transition duration-500 group-active:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />
            <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur-md"><Play size={14} fill="currentColor" /></span>
            <span className="absolute inset-x-0 bottom-0 p-3"><span className="line-clamp-2 text-xs font-black">{video.product?.title}</span><span className="mt-1 block text-[10px] text-white/70">{Number(video.counters?.views || 0).toLocaleString('fr-FR')} vues</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
};

/**
 * 🎨 PAGE D'ACCUEIL HDMarket - Design Alibaba Mobile First
 * Focus sur les bonnes affaires avec prix visibles
 * Architecture optimisée pour e-commerce
 */

export default function Home() {
  const { user } = useContext(AuthContext);
  const { categoryGroups, allCategoryOptions } = useCategories();
  const {
    city: preferredCity,
    cities: configuredCities,
    formatPrice,
    t,
    language,
    getRuntimeValue,
    isFeatureEnabled
  } = useAppSettings();
  const productVideosEnabled = isFeatureEnabled('product_videos', { defaultValue: false });
  // === ÉTATS PRINCIPAUX ===
  const [items, setItems] = useState([]);
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("new");
  const [installmentOnlyFilter, setInstallmentOnlyFilter] = useState(false);
  const [nearMeOnlyFilter, setNearMeOnlyFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get('page'));
  const initialPageRef = useRef(Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 767
  );
  const [highlights, setHighlights] = useState({
    favorites: [],
    topRated: [],
    topDeals: [],
    topDiscounts: [],
    newProducts: [],
    usedProducts: [],
    installmentProducts: [],
    cityHighlights: {}
  });
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [discountProducts, setDiscountProducts] = useState([]);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [topSalesProducts, setTopSalesProducts] = useState([]);
  const [topSalesLoading, setTopSalesLoading] = useState(false);
  const [topSalesCityTodayProducts, setTopSalesCityTodayProducts] = useState([]);
  const [topSalesCityTodayLoading, setTopSalesCityTodayLoading] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [verifiedShops, setVerifiedShops] = useState([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [promoShops, setPromoShops] = useState([]);
  const [promoShopsLoading, setPromoShopsLoading] = useState(false);
  const [flashDeals, setFlashDeals] = useState([]);
  const [flashDealsLoading, setFlashDealsLoading] = useState(false);
  const [activeFlashSales, setActiveFlashSales] = useState([]);
  const [activeFlashSalesLoading, setActiveFlashSalesLoading] = useState(false);
  const [flashNow, setFlashNow] = useState(() => Date.now());
  const [heroBanner, setHeroBanner] = useState('');
  const [buyForMeEnabled, setBuyForMeEnabled] = useState(false);
  const [parcelDeliveryEnabled, setParcelDeliveryEnabled] = useState(false);
  const [promoBanner, setPromoBanner] = useState('');
  const [promoBannerMobile, setPromoBannerMobile] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [homePromoBackgrounds, setHomePromoBackgrounds] = useState({
    freeDelivery: '',
    payForOther: '',
    buyForMe: '',
    parcel: ''
  });
  const [promoNow, setPromoNow] = useState(() => new Date());
  const [activePromo, setActivePromo] = useState(0);
  const [promoInteracted, setPromoInteracted] = useState(false);
  const promoCarouselRef = useRef(null);
  const [topProductsTab, setTopProductsTab] = useState('favorites');
  const [installmentProducts, setInstallmentProducts] = useState([]);
  const [installmentLoading, setInstallmentLoading] = useState(false);
  const [installmentNow, setInstallmentNow] = useState(() => Date.now());
  const [wholesaleProducts, setWholesaleProducts] = useState([]);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [homeFeedLoaded, setHomeFeedLoaded] = useState(false);
  const [shouldLoadSecondarySections, setShouldLoadSecondarySections] = useState(false);
  const [shouldLoadInstallment, setShouldLoadInstallment] = useState(false);
  const secondarySectionsRef = useRef(null);
  const installmentSectionRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);
  const loadMoreSentinelRef = useRef(null);
  const homeProductsAbortRef = useRef(null);
  const productsNextCursorRef = useRef('');
  // Stable per-mount seed so "Sélection du jour" shows a random set of photos
  // on each page load/refresh, without reshuffling on every unrelated re-render.
  const heroShuffleSeedRef = useRef(Math.floor(Math.random() * 2 ** 31) || 1);
const {
  rapid3GActive,
  compactProductsPageSize,
  compactSecondaryLimit,
  shouldUseOfflineSnapshot,
  offlineBannerText,
  rapid3GBannerText
} = useNetworkProfile();
const cityList = useMemo(
  () => (Array.isArray(configuredCities) ? configuredCities.map((item) => item.name).filter(Boolean) : []),
  [configuredCities]
);
const effectiveUserCity = preferredCity || user?.preferredCity || user?.city || '';
const externalLinkProps = useDesktopExternalLink();
const connectedUserDeliveryAddress = useMemo(() => {
  if (!user) return '';
  const fullAddress = String(user?.address || '').trim();
  if (fullAddress) return fullAddress;
  const locationParts = [user?.commune, user?.city].filter((entry) => typeof entry === 'string' && entry.trim());
  return locationParts.join(', ');
}, [user]);
const connectedUserDeliveryAddressLabel = useMemo(() => {
  if (connectedUserDeliveryAddress) return connectedUserDeliveryAddress;
  if (effectiveUserCity) return effectiveUserCity;
  return t('home.addressNotSet', 'Adresse non renseignée');
}, [connectedUserDeliveryAddress, effectiveUserCity, t]);
const compactDeliveryAddressLabel = useMemo(() => {
  const preciseAddress = String(user?.address || '').trim();
  if (preciseAddress) return preciseAddress;
  const commune = String(user?.commune || '').trim();
  if (commune) return commune;
  return t('home.addDeliveryAddress', 'Ajouter une adresse');
}, [t, user?.address, user?.commune]);
const hasDeliveryAddress = Boolean(connectedUserDeliveryAddress);
const hasUserCity = useMemo(
  () =>
    Boolean(
      effectiveUserCity &&
        (cityList.length === 0 || cityList.some((cityName) => cityName === effectiveUserCity))
    ),
  [cityList, effectiveUserCity]
);
const formatCurrency = (value) => formatPrice(value);
const formatCount = (value) =>
  Number(value || 0).toLocaleString(String(language || 'fr').startsWith('en') ? 'en-US' : 'fr-FR');
const showFullPaymentHomeBanner = normalizeSettingBoolean(
  getRuntimeValue('show_full_payment_home_banner', true),
  true
);
const sellingEnabled = normalizeSettingBoolean(getRuntimeValue('enable_selling', true), true);
const commerceCallout = sellingEnabled
  ? t('home.buyOrSellPrefix', 'Achetez ou vendez sur HDMarket —')
  : t('home.buyOnlyPrefix', 'Achetez sur HDMarket —');
const desktopHeroDescription = sellingEnabled
  ? t('home.heroDesktopSellEnabled', 'Découvrez {count} produits vérifiés. Vendez et achetez en toute confiance.').replace('{count}', formatCount(totalProducts))
  : t('home.heroDesktopBuyOnly', 'Découvrez {count} produits vérifiés près de vous.').replace('{count}', formatCount(totalProducts));
const fullPaymentBannerText =
  String(
    getRuntimeValue(
      'full_payment_banner_text',
      'Payez le montant total au checkout et profitez de la livraison offerte.'
    ) || ''
  ).trim() || 'Payez le montant total au checkout et profitez de la livraison offerte.';
const payForOtherEnabled = normalizeSettingBoolean(getRuntimeValue('enable_pay_for_other', false), false);
const showPayForOtherBanner =
  payForOtherEnabled &&
  normalizeSettingBoolean(getRuntimeValue('show_pay_for_other_home_banner', true), true);
const payForOtherBannerText =
  String(
    getRuntimeValue(
      'pay_for_other_banner_text',
      'Un proche peut régler votre commande — proposez-le au moment du paiement.'
    ) || ''
  ).trim() || 'Un proche peut régler votre commande — proposez-le au moment du paiement.';
const groupBuyingEnabled = normalizeSettingBoolean(getRuntimeValue('enable_group_buying', false), false);
const reduceMotionHome = useReducedMotion();
const primaryPageLimit = compactProductsPageSize || (isMobileView ? 12 : 15);
const secondarySectionLimit = compactSecondaryLimit || 6;

  useEffect(() => {
    if (promoInteracted || reduceMotionHome) return undefined;
    const timer = window.setInterval(() => {
      const carousel = promoCarouselRef.current;
      if (!carousel) return;
      setActivePromo((current) => {
        const next = (current + 1) % 4;
        const nextCard = carousel.children[next];
        if (nextCard) carousel.scrollTo({ left: Math.max(0, nextCard.offsetLeft - 20), behavior: 'smooth' });
        return next;
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [promoInteracted, reduceMotionHome]);
const homeSnapshotKey = useMemo(
  () =>
    [
      'home',
      isMobileView ? 'mobile' : 'desktop',
      effectiveUserCity || 'all',
      category || 'all',
      sort || 'new',
      installmentOnlyFilter ? 'installment' : 'standard',
      nearMeOnlyFilter ? 'nearme' : 'all',
      `limit-${primaryPageLimit}`
    ].join(':'),
  [
    category,
    effectiveUserCity,
    installmentOnlyFilter,
    isMobileView,
    nearMeOnlyFilter,
    primaryPageLimit,
    sort
  ]
);
const formatCountdown = (endDate, nowMs = Date.now()) => {
  const endMs = new Date(endDate || '').getTime();
  if (!Number.isFinite(endMs) || endMs <= nowMs) return t('home.expired', 'Expiré');
  const totalSeconds = Math.floor((endMs - nowMs) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}${t('home.dayShort', 'j')} ${hours.toString().padStart(2, '0')}${t('home.hourShort', 'h')}`;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};
  const defaultPromoBanner = '/promo-default.svg';
  const buildHomeProductLink = useCallback((product) => buildProductPath(product), []);
  const parsePromoDate = useCallback((value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, []);

  const hasPromoAsset = Boolean(promoBanner || promoBannerMobile);

  const isPromoActive = useMemo(() => {
    if (!hasPromoAsset) return false;
    const startDate = parsePromoDate(promoBannerStartAt);
    const endDate = parsePromoDate(promoBannerEndAt);
    if (startDate && promoNow < startDate) return false;
    if (endDate && promoNow > endDate) return false;
    return true;
  }, [hasPromoAsset, parsePromoDate, promoBannerEndAt, promoBannerStartAt, promoNow]);
  // === CHARGEMENT DES PRODUITS ===
  const loadProducts = useCallback(async () => {
    // Skip the network round-trip when the cached view already covers this
    // page (e.g. coming back from a product): the list is already rendered.
    const cachedView = readRouteViewCache(homeSnapshotKey);
    if (cachedView && Number(cachedView.page || 0) >= page) {
      productsNextCursorRef.current = String(cachedView.nextCursor || '');
      setLoading(false);
      return;
    }
    if (homeProductsAbortRef.current) {
      homeProductsAbortRef.current.abort('HOME_PRODUCTS_REPLACED');
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    homeProductsAbortRef.current = controller;
    setLoading(true);
    if (page <= 1) {
      setProductsError('');
      productsNextCursorRef.current = '';
    }
    setLoadMoreError('');
    try {
      const requestParams = { page, limit: primaryPageLimit, sort };
      if (
        isMobileView &&
        page > 1 &&
        productsNextCursorRef.current &&
        sort === 'new' &&
        !category &&
        !installmentOnlyFilter &&
        !nearMeOnlyFilter
      ) {
        requestParams.cursor = productsNextCursorRef.current;
      }
      if (category) requestParams.category = category;
      if (installmentOnlyFilter) requestParams.installmentOnly = true;
      if (hasUserCity) {
        requestParams.userCity = effectiveUserCity;
        requestParams.locationPriority = true;
      }
      if (nearMeOnlyFilter && hasUserCity) {
        requestParams.nearMe = true;
      }
      const { data } = await api.get("/products/public", {
        params: requestParams,
        signal: controller?.signal
      });
      if (controller && homeProductsAbortRef.current !== controller) return;
      const fetchedItems = Array.isArray(data) ? data : data.items || [];
      const pages = Array.isArray(data) ? 1 : data.pagination?.pages || 1;
      const total = Array.isArray(data)
        ? fetchedItems.length
        : Number(data?.pagination?.total) || fetchedItems.length;
      const nextCursor = String(data?.pagination?.nextCursor || data?.nextCursor || '');
      const nextTotalPages = nextCursor && isMobileView ? Math.max(page + 1, pages) : pages;
      setItems((prev) => {
        const nextItems = isMobileView && page > 1 ? [...prev, ...fetchedItems] : fetchedItems;
        writeRouteViewCache(homeSnapshotKey, {
          items: nextItems,
          page,
          totalPages: nextTotalPages,
          totalProducts: total,
          nextCursor
        });
        return nextItems;
      });
      productsNextCursorRef.current = nextCursor;
      setTotalPages(nextTotalPages);
      setTotalProducts(total);
      setOfflineSnapshotActive(false);
    } catch (error) {
      if (isApiCanceledError(error)) {
        return;
      }
      if (controller?.signal?.aborted) return;
      if (shouldUseOfflineSnapshot) {
        const snapshot = await loadOfflineSnapshot(homeSnapshotKey);
        if (snapshot && typeof snapshot === 'object') {
          const snapshotItems = Array.isArray(snapshot.items) ? snapshot.items : [];
          const snapshotTotalPages = Math.max(1, Number(snapshot.totalPages) || 1);
          const snapshotTotalProducts = Number(snapshot.totalProducts) || 0;
          setItems(snapshotItems);
          setTotalPages(snapshotTotalPages);
          setTotalProducts(snapshotTotalProducts);
          writeRouteViewCache(homeSnapshotKey, {
            items: snapshotItems,
            page,
            totalPages: snapshotTotalPages,
            totalProducts: snapshotTotalProducts,
            nextCursor: ''
          });
          setOfflineSnapshotActive(true);
          setProductsError('');
          setLoadMoreError('');
          return;
        }
      }
      const slowNetworkMessage = 'Chargement prolongé. Réessayez dans un instant.';
      if (isMobileView && page > 1) {
        setLoadMoreError(slowNetworkMessage);
      } else {
        setProductsError(slowNetworkMessage);
      }
    } finally {
      if (!controller || homeProductsAbortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [
    page,
    sort,
    category,
    installmentOnlyFilter,
    hasUserCity,
    nearMeOnlyFilter,
    isMobileView,
    effectiveUserCity,
    primaryPageLimit,
    shouldUseOfflineSnapshot,
    homeSnapshotKey
  ]);

  const loadInstallmentProducts = useCallback(async () => {
    setInstallmentLoading(true);
    try {
      const { data } = await api.get('/products/public/installments', {
        params: { page: 1, limit: compactSecondaryLimit || 8 }
      });
      setInstallmentProducts(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      if (isApiCanceledError(error)) {
        return;
      }
      console.error('Erreur chargement produits tranche:', error);
      setInstallmentProducts([]);
    } finally {
      setInstallmentLoading(false);
    }
  }, [compactSecondaryLimit]);

  const loadWholesaleProducts = useCallback(async () => {
    setWholesaleLoading(true);
    try {
      const params = {
        page: 1,
        limit: compactSecondaryLimit || (isMobileView ? 8 : 10)
      };
      if (hasUserCity && effectiveUserCity) {
        params.userCity = effectiveUserCity;
        params.nearMe = true;
      }
      const { data } = await api.get('/products/public/wholesale', { params });
      setWholesaleProducts(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      if (isApiCanceledError(error)) {
        return;
      }
      console.error('Erreur chargement produits en gros:', error);
      setWholesaleProducts([]);
    } finally {
      setWholesaleLoading(false);
    }
  }, [compactSecondaryLimit, effectiveUserCity, hasUserCity, isMobileView]);

  useEffect(() => {
    let active = true;
    const loadHeroBanner = async () => {
      try {
        const { data } = await api.get('/settings/hero-banner');
        if (!active) return;
        setHeroBanner(data?.heroBanner || '');
      } catch (error) {
        if (!active) return;
        setHeroBanner('');
      }
    };
    loadHeroBanner();
    const unsubscribe = subscribeToSettingsRefresh(loadHeroBanner);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/buy-for-me/capabilities')
      .then(({ data }) => {
        if (active) setBuyForMeEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (active) setBuyForMeEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/parcels/capabilities')
      .then(({ data }) => {
        if (active) setParcelDeliveryEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (active) setParcelDeliveryEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPromoBanner = async () => {
      try {
        const { data } = await api.get('/settings/promo-banner', { silentGlobalError: true });
        if (!active) return;
        setPromoBanner(data?.promoBanner || '');
        setPromoBannerMobile(data?.promoBannerMobile || '');
        setPromoBannerLink(data?.promoBannerLink || '');
        setPromoBannerStartAt(data?.promoBannerStartAt || '');
        setPromoBannerEndAt(data?.promoBannerEndAt || '');
        setHomePromoBackgrounds({
          freeDelivery: data?.homePromoFreeDeliveryBackground || '',
          payForOther: data?.homePromoPayForOtherBackground || '',
          buyForMe: data?.homePromoBuyForMeBackground || '',
          parcel: data?.homePromoParcelBackground || ''
        });
      } catch (error) {
        if (!active) return;
        setPromoBanner('');
        setPromoBannerMobile('');
        setPromoBannerLink('');
        setPromoBannerStartAt('');
        setPromoBannerEndAt('');
        setHomePromoBackgrounds({ freeDelivery: '', payForOther: '', buyForMe: '', parcel: '' });
      }
    };
    loadPromoBanner();
    const unsubscribe = subscribeToSettingsRefresh(loadPromoBanner);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPromoNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // === CHARGEMENT DES PRODUITS EN VEDETTE ===
  const loadHighlights = async () => {
    setHighlightLoading(true);
    try {
      const { data } = await api.get("/products/public/highlights");
        setHighlights({
          favorites: Array.isArray(data?.favorites) ? data.favorites : [],
          topRated: Array.isArray(data?.topRated) ? data.topRated : [],
          topDeals: Array.isArray(data?.topDeals) ? data.topDeals : [],
          topDiscounts: Array.isArray(data?.topDiscounts) ? data.topDiscounts : [],
          newProducts: Array.isArray(data?.newProducts) ? data.newProducts : [],
          usedProducts: Array.isArray(data?.usedProducts) ? data.usedProducts : [],
          installmentProducts: Array.isArray(data?.installmentProducts) ? data.installmentProducts : [],
          cityHighlights:
            data?.cityHighlights && typeof data.cityHighlights === 'object'
              ? data.cityHighlights
              : {}
        });
    } catch (error) {
      console.error("Erreur chargement highlights:", error);
    } finally {
      setHighlightLoading(false);
    }
  };

  const loadVerifiedShops = async () => {
    setVerifiedLoading(true);
    try {
      const { data } = await api.get('/shops', {
        params: {
          verified: 'true',
          limit: secondarySectionLimit,
          withViews: 'false',
          withRatings: 'false'
        }
      });
      const verifiedOnly = Array.isArray(data) ? data : [];
      setVerifiedShops(verifiedOnly.slice(0, secondarySectionLimit));
    } catch (error) {
      console.error("Erreur chargement boutiques vérifiées:", error);
      setVerifiedShops([]);
    } finally {
      setVerifiedLoading(false);
    }
  };

  const loadPromoHomeData = async () => {
    setPromoShopsLoading(true);
    setFlashDealsLoading(true);
    setActiveFlashSalesLoading(true);
    try {
      const { data } = await api.get('/marketplace-promo-codes/public/home', {
        params: {
          shopLimit: compactSecondaryLimit || 8,
          flashLimit: compactSecondaryLimit || 8
        }
      });
      setPromoShops(Array.isArray(data?.promoShops) ? data.promoShops : []);
      setFlashDeals(Array.isArray(data?.flashDeals) ? data.flashDeals : []);
    } catch (error) {
      console.error('Erreur chargement promos homepage:', error);
      setPromoShops([]);
      setFlashDeals([]);
    } finally {
      setPromoShopsLoading(false);
      setFlashDealsLoading(false);
    }

    // Fetch flash sales from new system
    try {
      const { data: fsData } = await api.get('/flash-sales', { params: { limit: 8 } });
      setActiveFlashSales(fsData?.items || []);
    } catch {
      setActiveFlashSales([]);
    } finally {
      setActiveFlashSalesLoading(false);
    }
  };

  // === CHARGEMENT DES PRODUITS EN PROMOTION ===
// === CHARGEMENT DES PRODUITS EN PROMOTION ===
const loadDiscountProducts = async () => {
  setDiscountLoading(true);
  try {
    const { data } = await api.get("/products/public", { 
      params: { 
        sort: 'discount',
        limit: compactSecondaryLimit || 8,
        page: 1
      } 
    });
    const discountItems = Array.isArray(data) ? data : data.items || [];
    
    const realDiscountProducts = discountItems.filter(product => 
      product.discount > 0 && 
      product.priceBeforeDiscount && // Vérifier que priceBeforeDiscount existe
      product.price < product.priceBeforeDiscount // Comparer avec priceBeforeDiscount
    );
    
    const shuffled = [...realDiscountProducts].sort(() => Math.random() - 0.5);
    setDiscountProducts(shuffled.slice(0, Math.min(4, compactSecondaryLimit || 4)));
  } catch (error) {
    console.error("Erreur chargement produits en promotion:", error);
  } finally {
    setDiscountLoading(false);
  }
};

  const renderPromoBanner = () => {
    if (!hasPromoAsset) return null;
    const activeBanner = isMobileView && promoBannerMobile ? promoBannerMobile : promoBanner;
    const bannerSrc = isPromoActive ? activeBanner : defaultPromoBanner;
    const bannerLink = isPromoActive ? promoBannerLink : '/products';
    const bannerImage = (
      <img
        src={bannerSrc}
        alt="Bannière promotionnelle"
        className="h-full w-full object-contain bg-white p-1 transition-transform duration-300"
        loading="lazy"
      />
    );
    const wrapperClass =
      "group block w-full overflow-hidden rounded-[16px] border border-[#E5E5EA] bg-white shadow-sm aspect-[16/9] sm:aspect-[21/7] lg:aspect-[24/7] dark:bg-[#1C1C1E] dark:border-[#38383A]";
    if (bannerLink) {
      if (bannerLink.startsWith('/')) {
        return (
          <Link to={bannerLink} {...externalLinkProps} className={wrapperClass}>
            {bannerImage}
          </Link>
        );
      }
      return (
        <a
          href={bannerLink}
          target="_blank"
          rel="noopener noreferrer"
          className={wrapperClass}
        >
          {bannerImage}
        </a>
      );
    }
    return <div className={wrapperClass}>{bannerImage}</div>;
  };

  // === EFFETS DE CHARGEMENT ===
  // Restore the last viewed product list for this exact home view (layout
  // effect so it runs before the fetch effect): coming back to the page shows
  // the previous content instantly instead of a loading state, which also
  // lets scroll restoration land at the right position.
  useLayoutEffect(() => {
    const cached = readRouteViewCache(homeSnapshotKey);
    if (!cached) return;
    setItems(Array.isArray(cached.items) ? cached.items : []);
    setTotalPages(Math.max(1, Number(cached.totalPages) || 1));
    setTotalProducts(Number(cached.totalProducts) || 0);
    productsNextCursorRef.current = String(cached.nextCursor || '');
    setProductsError('');
    setLoadMoreError('');
    setLoading(false);
  }, [homeSnapshotKey]);

  useEffect(() => {
    initialPageRef.current = 1;
    setPage((prev) => (prev === 1 ? prev : 1));
  }, [sort, category, installmentOnlyFilter, nearMeOnlyFilter]);

  useEffect(() => {
    loadProducts();
  }, [page, sort, category, installmentOnlyFilter, isMobileView, loadProducts]);

  useEffect(() => {
    return () => {
      if (homeProductsAbortRef.current) {
        homeProductsAbortRef.current.abort('HOME_UNMOUNTED');
      }
    };
  }, []);

  useEffect(() => {
    if (!hasUserCity && nearMeOnlyFilter) {
      setNearMeOnlyFilter(false);
    }
  }, [hasUserCity, nearMeOnlyFilter]);

  useEffect(() => {
    const targetPage = page === 1 ? null : String(page);
    const currentInUrl = searchParams.get('page');
    if (currentInUrl === targetPage) return;

    const next = new URLSearchParams(searchParams);
    if (targetPage == null) {
      next.delete('page');
    } else {
      next.set('page', targetPage);
    }

    setSearchParams(next, { replace: true });
  }, [page, searchParams, setSearchParams]);

  useEffect(() => {
    const validPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    initialPageRef.current = validPage;
    setPage((prev) => (prev === validPage ? prev : validPage));
  }, [pageParam]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobileView(window.innerWidth <= 767);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Triggers "load more" as the user nears the end of the PRODUCT GRID
  // itself, via a sentinel placed right after it — not the bottom of the
  // whole document. The previous scroll-based check measured against
  // document.documentElement.scrollHeight, which includes the footer, so it
  // only fired once the user scrolled almost all the way past the footer.
  useEffect(() => {
    if (!isMobileView) return undefined;
    if (loading) return undefined;
    if (loadMoreError) return undefined;
    if (page >= totalPages) return undefined;
    const node = loadMoreSentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const now = Date.now();
        if (entry?.isIntersecting && now - infiniteScrollLockRef.current >= 400) {
          infiniteScrollLockRef.current = now;
          setPage((prev) => Math.min(prev + 1, totalPages));
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobileView, loading, loadMoreError, page, totalPages]);

  useEffect(() => {
    if (!shouldLoadSecondarySections) return undefined;
    if (!installmentSectionRef.current) return undefined;
    if (shouldLoadInstallment) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setShouldLoadInstallment(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px' }
    );
    observer.observe(installmentSectionRef.current);
    return () => observer.disconnect();
  }, [shouldLoadInstallment, shouldLoadSecondarySections]);

  useEffect(() => {
    if (shouldLoadSecondarySections) return undefined;
    if (!isMobileView) {
      const timer = window.setTimeout(() => setShouldLoadSecondarySections(true), 250);
      return () => window.clearTimeout(timer);
    }
    const node = secondarySectionsRef.current;
    if (!node) {
      const timer = window.setTimeout(() => setShouldLoadSecondarySections(true), 900);
      return () => window.clearTimeout(timer);
    }
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoadSecondarySections(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setShouldLoadSecondarySections(true);
          observer.disconnect();
        }
      },
      { rootMargin: '520px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobileView, shouldLoadSecondarySections]);

  useEffect(() => {
    if (!shouldLoadInstallment) return;
    // The /home/feed response already provides installment products; only fall
    // back to the dedicated (heavier) endpoint when the feed hasn't loaded.
    if (homeFeedLoaded) return;
    loadInstallmentProducts();
  }, [shouldLoadInstallment, homeFeedLoaded, loadInstallmentProducts]);

  const loadTopSales = async () => {
    setTopSalesLoading(true);
    try {
      const { data } = await api.get('/products/public/top-sales', {
        params: { limit: secondarySectionLimit, page: 1 }
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTopSalesProducts(items);
    } catch (error) {
      if (isApiCanceledError(error)) {
        return;
      }
      console.error("Erreur chargement produits les plus vendus:", error);
      setTopSalesProducts([]);
    } finally {
      setTopSalesLoading(false);
    }
  };

  const loadTopSalesTodayByCity = useCallback(async () => {
    if (!hasUserCity || !effectiveUserCity) {
      setTopSalesCityTodayProducts([]);
      setTopSalesCityTodayLoading(false);
      return;
    }
    setTopSalesCityTodayLoading(true);
    try {
      const { data } = await api.get('/products/public/top-sales/today', {
        params: {
          city: effectiveUserCity,
          limit: compactSecondaryLimit || (isMobileView ? 8 : 6),
          page: 1
        }
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTopSalesCityTodayProducts(items);
    } catch (error) {
      if (isApiCanceledError(error)) {
        return;
      }
      console.error("Erreur chargement top ventes ville (aujourd'hui):", error);
      setTopSalesCityTodayProducts([]);
    } finally {
      setTopSalesCityTodayLoading(false);
    }
  }, [compactSecondaryLimit, effectiveUserCity, hasUserCity, isMobileView]);

  const loadHomeFeed = useCallback(async () => {
    setPromoShopsLoading(true);
    setFlashDealsLoading(true);
    setActiveFlashSalesLoading(true);
    setHighlightLoading(true);
    setTopSalesLoading(true);
    setVerifiedLoading(true);
    setDiscountLoading(true);
    setWholesaleLoading(true);
    if (hasUserCity && effectiveUserCity) {
      setTopSalesCityTodayLoading(true);
    }

    try {
      const { data } = await api.get('/home/feed', {
        params: {
          secondaryLimit: secondarySectionLimit,
          cityLimit: compactSecondaryLimit || (isMobileView ? 8 : 6),
          city: hasUserCity ? effectiveUserCity : ''
        }
      });
      const feedHighlights = data?.highlights || {};
      setHighlights({
        favorites: Array.isArray(feedHighlights.favorites) ? feedHighlights.favorites : [],
        topRated: Array.isArray(feedHighlights.topRated) ? feedHighlights.topRated : [],
        topDeals: Array.isArray(feedHighlights.topDeals) ? feedHighlights.topDeals : [],
        topDiscounts: Array.isArray(feedHighlights.topDiscounts) ? feedHighlights.topDiscounts : [],
        newProducts: Array.isArray(feedHighlights.newProducts) ? feedHighlights.newProducts : [],
        usedProducts: Array.isArray(feedHighlights.usedProducts) ? feedHighlights.usedProducts : [],
        installmentProducts: Array.isArray(feedHighlights.installmentProducts)
          ? feedHighlights.installmentProducts
          : [],
        cityHighlights:
          feedHighlights.cityHighlights && typeof feedHighlights.cityHighlights === 'object'
            ? feedHighlights.cityHighlights
            : {}
      });
      setTopSalesProducts(Array.isArray(data?.topSales) ? data.topSales : []);
      setDiscountProducts(Array.isArray(data?.discountProducts) ? data.discountProducts : []);
      setVerifiedShops(Array.isArray(data?.verifiedShops) ? data.verifiedShops : []);
      setPromoShops(Array.isArray(data?.promoShops) ? data.promoShops : []);
      setFlashDeals(Array.isArray(data?.flashDeals) ? data.flashDeals : []);
      setActiveFlashSales(Array.isArray(data?.activeFlashSales) ? data.activeFlashSales : []);
      setWholesaleProducts(Array.isArray(data?.wholesaleProducts) ? data.wholesaleProducts : []);
      setTopSalesCityTodayProducts(Array.isArray(data?.topSalesCityToday) ? data.topSalesCityToday : []);
      setInstallmentProducts(
        Array.isArray(feedHighlights.installmentProducts) ? feedHighlights.installmentProducts : []
      );
      setHomeFeedLoaded(true);
    } catch (error) {
      if (isApiCanceledError(error)) return;
      setHomeFeedLoaded(false);
      await Promise.allSettled([
        loadPromoHomeData(),
        loadHighlights(),
        loadTopSales(),
        loadVerifiedShops(),
        loadDiscountProducts(),
        loadWholesaleProducts(),
        loadTopSalesTodayByCity()
      ]);
    } finally {
      setPromoShopsLoading(false);
      setFlashDealsLoading(false);
      setActiveFlashSalesLoading(false);
      setHighlightLoading(false);
      setTopSalesLoading(false);
      setVerifiedLoading(false);
      setDiscountLoading(false);
      setWholesaleLoading(false);
      setTopSalesCityTodayLoading(false);
    }
  }, [
    compactSecondaryLimit,
    effectiveUserCity,
    hasUserCity,
    isMobileView,
    loadTopSalesTodayByCity,
    loadWholesaleProducts,
    secondarySectionLimit
  ]);

  useEffect(() => {
    if (!shouldLoadSecondarySections) return;
    const timers = [];
    const schedule = (task, delay = 0) => {
      const timer = window.setTimeout(() => {
        task();
      }, delay);
      timers.push(timer);
    };

    schedule(loadHomeFeed, 0);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [loadHomeFeed, shouldLoadSecondarySections]);

  useEffect(() => {
    if (homeFeedLoaded) return undefined;
    if (!shouldLoadSecondarySections) return;
    const timer = window.setTimeout(
      () => loadTopSalesTodayByCity(),
      rapid3GActive ? 520 : 120
    );
    return () => window.clearTimeout(timer);
  }, [homeFeedLoaded, loadTopSalesTodayByCity, rapid3GActive, shouldLoadSecondarySections]);

  useEffect(() => {
    if (homeFeedLoaded) return undefined;
    if (!shouldLoadSecondarySections) return;
    const timer = window.setTimeout(
      () => loadWholesaleProducts(),
      rapid3GActive ? 760 : 180
    );
    return () => window.clearTimeout(timer);
  }, [homeFeedLoaded, loadWholesaleProducts, rapid3GActive, shouldLoadSecondarySections]);

  useEffect(() => {
    if (!flashDeals.length) return undefined;
    const timer = setInterval(() => {
      setFlashNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [flashDeals.length]);

  useEffect(() => {
    if (!items.length) return;
    if (shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(homeSnapshotKey, {
      items,
      totalPages,
      totalProducts
    });
  }, [homeSnapshotKey, items, shouldUseOfflineSnapshot, totalPages, totalProducts]);

  const cityHighlights = highlights.cityHighlights || {};
  const installmentSectionProducts = useMemo(
    () => installmentProducts.length
      ? installmentProducts
      : highlights.installmentProducts,
    [highlights.installmentProducts, installmentProducts]
  );
  const activeInstallmentProducts = useMemo(
    () => filterActiveInstallmentProducts(installmentSectionProducts, installmentNow),
    [installmentNow, installmentSectionProducts]
  );
  useEffect(() => {
    const nextExpiry = installmentSectionProducts.reduce((nearest, product) => {
      const expiry = new Date(product?.installmentEndDate || '').getTime();
      if (!Number.isFinite(expiry) || expiry <= installmentNow) return nearest;
      return nearest === null || expiry < nearest ? expiry : nearest;
    }, null);
    if (nextExpiry === null) return undefined;

    const timer = window.setTimeout(
      () => setInstallmentNow(Date.now()),
      Math.min(Math.max(25, nextExpiry - Date.now() + 25), 2_147_483_647)
    );
    return () => window.clearTimeout(timer);
  }, [installmentNow, installmentSectionProducts]);
  const cityFallbackProductsByCity = useMemo(() => {
    const map = new Map();
    const seenByCity = new Map();
    const pooledProducts = [
      ...(Array.isArray(items) ? items : []),
      ...(Array.isArray(topSalesCityTodayProducts) ? topSalesCityTodayProducts : []),
      ...(Array.isArray(topSalesProducts) ? topSalesProducts : []),
      ...(Array.isArray(highlights.favorites) ? highlights.favorites : []),
      ...(Array.isArray(highlights.topRated) ? highlights.topRated : []),
      ...(Array.isArray(highlights.topDeals) ? highlights.topDeals : []),
      ...(Array.isArray(highlights.topDiscounts) ? highlights.topDiscounts : []),
      ...(Array.isArray(highlights.newProducts) ? highlights.newProducts : []),
      ...(Array.isArray(highlights.usedProducts) ? highlights.usedProducts : []),
      ...(Array.isArray(highlights.installmentProducts) ? highlights.installmentProducts : [])
    ];

    pooledProducts.forEach((product) => {
      const productId = product?._id || product?.id;
      if (!productId) return;
      const cityName = resolveProductCity(product);
      const normalizedCity = normalizeCityName(cityName);
      if (!normalizedCity) return;

      if (!map.has(normalizedCity)) {
        map.set(normalizedCity, []);
      }
      if (!seenByCity.has(normalizedCity)) {
        seenByCity.set(normalizedCity, new Set());
      }

      const seenSet = seenByCity.get(normalizedCity);
      const productKey = String(productId);
      if (seenSet.has(productKey)) return;
      seenSet.add(productKey);
      map.get(normalizedCity).push(product);
    });

    return map;
  }, [highlights, items, topSalesCityTodayProducts, topSalesProducts]);

  // === PAGINATION SIMPLIFIÉE ===
  const renderPagination = () => {
    if (isMobileView) return null;
    if (totalPages <= 1) return null;

    return (
      <div className="flex justify-center items-center space-x-2 mt-8">
        {/* Bouton Précédent */}
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>

        {/* Pages */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const pageNum = i + 1;
          return (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                page === pageNum
                  ? "bg-neutral-900 text-white border-neutral-600"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Indicateur de pages supplémentaires */}
        {totalPages > 5 && (
          <span className="px-2 text-gray-500">...</span>
        )}

        {/* Bouton Suivant */}
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>
    );
  };

  // === MOBILE COMPACT FEED LAYOUT (Proposal A) ===
  const renderMobileHome = () => {
    const fallbackDeals = [
      ...highlights.topDeals.slice(0, 4),
      ...discountProducts.filter(p => !highlights.topDeals.some(d => d._id === p._id)).slice(0, 4)
    ].slice(0, 8);
    const displayFlashDeals = (flashDeals.length ? flashDeals : fallbackDeals).slice(0, 8);
    const heroProductsPool = [...displayFlashDeals, ...topSalesProducts, ...items].filter(Boolean);
    const seenHeroProductIds = new Set();
    const uniqueHeroProductsPool = heroProductsPool.filter((product) => {
      const id = String(product?._id || '');
      if (!id || seenHeroProductIds.has(id)) return false;
      seenHeroProductIds.add(id);
      return true;
    });
    const heroProducts = seededShuffle(uniqueHeroProductsPool, heroShuffleSeedRef.current).slice(0, 4);
    const discoveryTabs = [
      { label: 'Recommandé', to: '/' },
      { label: 'Mode', to: '/categories/pret-porter' },
      { label: 'Maison', to: '/categories/meubles' },
      { label: '3C Tech', to: '/categories/telephones' },
      { label: 'Promos', to: '/top-deals' }
    ];
    const shortcutItems = [
      { label: 'Top Picks', icon: Award, to: '/top-ranking' },
      { label: 'Boutiques', icon: Store, to: '/shops/verified' },
      { label: 'Bon prix', icon: Zap, to: '/top-deals' },
      { label: 'Livraison', icon: Truck, to: '/shops/free-delivery' },
      { label: 'Découvrir', icon: Sparkles, to: '/discover' }
    ];
    const promoCards = [
      { badge: 'LIVRAISON OFFERTE', text: fullPaymentBannerText, cta: 'Voir', color: '#00A860', bg: '#E7F8EF', icon: Truck, to: '/products', backgroundImage: homePromoBackgrounds.freeDelivery },
      { badge: 'PAIEMENT PAR UN PROCHE', text: payForOtherBannerText, cta: 'Voir', color: '#F26522', bg: '#FDF3E7', icon: Users, to: '/cart', backgroundImage: homePromoBackgrounds.payForOther },
      ...(buyForMeEnabled ? [{ badge: 'NOUVEAU', text: 'Acheter Pour Moi — un livreur fait vos courses.', cta: 'Essayer', color: '#7C3AED', bg: '#F1EDFB', icon: ShoppingBag, to: '/buy-for-me', backgroundImage: homePromoBackgrounds.buyForMe }] : []),
      { badge: 'ENVOI DE COLIS', text: 'Un livreur récupère et livre où vous voulez.', cta: 'Envoyer', color: '#0B87D4', bg: '#EBF4FD', icon: Package, to: '/parcels/new', backgroundImage: homePromoBackgrounds.parcel }
    ];

    const scrollStyle = { WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' };
    const handlePromoScroll = (event) => {
      const carousel = event.currentTarget;
      const firstCard = carousel.children[0];
      if (!firstCard) return;
      const cardStep = firstCard.offsetWidth + 12;
      setActivePromo(Math.max(0, Math.min(promoCards.length - 1, Math.round(carousel.scrollLeft / cardStep))));
    };
    const stopPromoAutoplay = () => setPromoInteracted(true);

    return (
      <main className="mx-auto flex max-w-7xl flex-col gap-5 bg-[#f7f8fa] px-5 pb-24 pt-0 text-[#1b1d22] max-[375px]:gap-4 max-[375px]:px-4">
        {user ? (
          <div className="order-[-30] pt-3">
            <HomeGreeting user={user} />
          </div>
        ) : null}

        {/* Pour Vous — AI Recommendations (placed prominently at top) */}
        <div className="hidden">
          <PourVousSection
            user={user}
            t={t}
            formatPrice={formatPrice}
            buildProductLink={buildHomeProductLink}
            externalLinkProps={externalLinkProps}
          />
        </div>

        <div className="order-[-10] -mx-5 max-[375px]:-mx-4">
          <GroupBuyHomeSection enabled={groupBuyingEnabled} />
        </div>

        <ProductVideosHomeSection enabled={productVideosEnabled} />

        {(showFullPaymentHomeBanner || showPayForOtherBanner || buyForMeEnabled || parcelDeliveryEnabled) ? (
          <section className="hidden order-[-20] overflow-hidden rounded-2xl border border-[#eee8e0] bg-white shadow-sm">
            {showFullPaymentHomeBanner ? (
              <Link
                to="/products"
                {...externalLinkProps}
                className="group block bg-emerald-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <Truck className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                      <Sparkles className="h-3 w-3" />
                      Livraison offerte
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
                      {fullPaymentBannerText}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm">
                    Voir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : null}
            {showPayForOtherBanner ? (
              <Link
                to="/cart"
                {...externalLinkProps}
                className={`group block bg-amber-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99] dark:bg-amber-950/40 ${
                  showFullPaymentHomeBanner ? 'border-t border-gray-200 dark:border-neutral-800' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e85d00] text-white shadow-sm">
                    <Users className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#e85d00] ring-1 ring-orange-100">
                      <Sparkles className="h-3 w-3" />
                      Paiement par un proche
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
                      {payForOtherBannerText}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e85d00] px-3 py-2 text-[11px] font-black text-white shadow-sm">
                    Voir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : null}
            {buyForMeEnabled ? (
              <Link
                to="/buy-for-me"
                {...externalLinkProps}
                className={`group block bg-violet-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99] dark:bg-violet-950/40 ${
                  showFullPaymentHomeBanner || showPayForOtherBanner ? 'border-t border-gray-200 dark:border-neutral-800' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                    <ShoppingBag className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700 ring-1 ring-violet-100">
                      <Sparkles className="h-3 w-3" />
                      Nouveau
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
                      Acheter Pour Moi — un livreur fait vos courses et vous livre
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-2 text-[11px] font-black text-white shadow-sm">
                    Essayer
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : null}
            {parcelDeliveryEnabled ? (
              <Link
                to="/parcels/new"
                {...externalLinkProps}
                className={`group block bg-sky-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99] dark:bg-sky-950/40 ${
                  showFullPaymentHomeBanner || showPayForOtherBanner || buyForMeEnabled ? 'border-t border-gray-200 dark:border-neutral-800' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
                    <Package className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700 ring-1 ring-sky-100">
                      <Truck className="h-3 w-3" />
                      Course à la demande
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
                      Envoyer un colis — un livreur récupère et livre où vous voulez
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-600 px-3 py-2 text-[11px] font-black text-white shadow-sm">
                    Envoyer
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : null}
          </section>
        ) : null}


        <section className="home-anim-gradient order-[-30] -mx-5 overflow-hidden rounded-b-[26px] bg-[linear-gradient(160deg,#ff8a1e_0%,#f26522_55%,#eb5a14_100%)] text-white max-[375px]:-mx-4">
          <div className="relative px-5 pb-[22px] pt-[max(58px,env(safe-area-inset-top))] max-[375px]:px-4">
            <div className="home-anim-float pointer-events-none absolute left-32 -top-8 h-16 w-16 rounded-full bg-amber-200/20 blur-xl" />
            <div className="home-anim-float pointer-events-none absolute -right-6 top-10 h-20 w-20 rounded-full bg-white/10 blur-xl" style={{ animationDelay: '2.4s' }} />
            <div className="home-anim-fade-up relative flex items-center justify-between gap-3">
              <Link to="/" className="flex items-center gap-2" {...externalLinkProps}>
                <span className="text-[26px] font-black leading-none tracking-[-0.5px]">HDMarket</span>
              </Link>
              <div className="inline-flex min-w-0 max-w-[210px] items-center rounded-full bg-white/20 px-2.5 py-2 backdrop-blur-sm max-[375px]:max-w-[184px]">
                <Link
                  to="/cities"
                  {...externalLinkProps}
                  className="inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full px-0 py-0 text-[12.5px] font-extrabold"
                  title={effectiveUserCity || 'Local'}
                >
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="max-w-[64px] truncate max-[375px]:max-w-[50px]">{effectiveUserCity || 'Local'}</span>
                </Link>
                {user ? (
                  <>
                    <span className="mx-2 h-4 w-px shrink-0 bg-white/40" aria-hidden="true" />
                    <Link
                      to="/profile"
                      className={`min-w-0 flex-1 truncate rounded-full px-0 py-0 text-[12px] font-bold ${
                        hasDeliveryAddress ? 'text-white/90' : 'bg-amber-300/20 text-amber-50'
                      }`}
                      title={`${t('home.deliveryAddress', 'Adresse de livraison')} : ${connectedUserDeliveryAddressLabel}`}
                    >
                      {compactDeliveryAddressLabel}
                    </Link>
                  </>
                ) : null}
              </div>
            </div>

            <div className="home-anim-fade-up relative mt-[18px] flex gap-6 overflow-x-auto pb-2 hide-scrollbar" style={{ ...scrollStyle, '--home-anim-delay': '90ms' }}>
              {discoveryTabs.map((tab, index) => (
                <Link
                  key={tab.label}
                  to={tab.to}
                  {...externalLinkProps}
                  className={`relative flex-shrink-0 text-[16px] font-black ${index === 0 ? 'text-white' : 'text-white/75'}`}
                >
                  {tab.label}
                  {index === 0 ? <span className="absolute -bottom-2 left-0 h-1 w-[26px] rounded-full bg-white" /> : null}
                </Link>
              ))}
            </div>

            <div className="home-anim-fade-up relative mt-3 flex h-[54px] items-center gap-2 rounded-full bg-white py-[6px] pl-2 pr-[6px] shadow-[0_6px_16px_rgba(180,70,0,0.18)]" style={{ '--home-anim-delay': '160ms' }}>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="inline-flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[#fbf2ea] text-[#f26522] active:scale-95"
                aria-label="Ouvrir les catégories"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <Link
                to="/products"
                {...externalLinkProps}
                className="min-w-0 flex-1 truncate text-left text-[14.5px] font-bold text-[#3a3e46]"
              >
                Rechercher produits, boutiques, ville...
              </Link>
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-full bg-[#e05a0f] text-white active:scale-95"
                aria-label="Rechercher"
              >
                <Search className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </section>

        <section className="order-[-20] -mx-5 pt-[14px] max-[375px]:-mx-4" aria-label="Promotions HDMarket">
          <div
            ref={promoCarouselRef}
            onScroll={handlePromoScroll}
            onPointerDown={stopPromoAutoplay}
            onTouchStart={stopPromoAutoplay}
            onWheel={stopPromoAutoplay}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[375px]:px-4"
            style={scrollStyle}
          >
            {promoCards.map(({ badge, text, cta, color, bg, icon: Icon, to, backgroundImage }) => (
              <Link
                key={badge}
                to={to}
                {...externalLinkProps}
                className="relative flex min-h-[232px] w-[84%] shrink-0 snap-center overflow-hidden rounded-[24px] active:scale-[0.99]"
                style={{ backgroundColor: bg }}
              >
                {backgroundImage ? (
                  <>
                    <img src={backgroundImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    {/* Clear on top so the image shows, solid brand color at the bottom behind the text */}
                    <span className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${bg}00 26%, ${bg}59 55%, ${bg}d9 78%, ${bg}f2 100%)` }} />
                  </>
                ) : null}
                <div className="relative flex w-full flex-col justify-between gap-4 p-[18px] pb-4">
                  <span className="w-fit rounded-full bg-white/85 px-3 py-1 text-[11px] font-black tracking-[0.6px]" style={{ color }}>{badge}</span>
                  <div className="flex max-w-[85%] flex-col items-start gap-2.5">
                    <p className="text-[17px] font-extrabold leading-[1.35] text-[#1b1d22]">{text}</p>
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-extrabold text-white" style={{ backgroundColor: color }}>{cta}<ChevronRight className="h-[13px] w-[13px] stroke-[3]" /></span>
                  </div>
                </div>
                {!backgroundImage ? (
                  <span className="absolute right-[18px] top-[18px] grid h-11 w-11 place-items-center rounded-[14px] text-white" style={{ backgroundColor: color }}><Icon className="h-5 w-5" /></span>
                ) : null}
              </Link>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 pt-2.5" aria-label={`Promotion ${activePromo + 1} sur ${promoCards.length}`}>
            {promoCards.map((promo, index) => <span key={promo.badge} className={`h-1.5 rounded-full transition-all duration-250 ${index === activePromo ? 'w-5 bg-[#f26522]' : 'w-1.5 bg-[#dddfe5]'}`} />)}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#eeeff3] bg-white p-[14px_12px] shadow-none">
          <div className="grid grid-cols-5 gap-2">
            {shortcutItems.map(({ label, icon: Icon, to }, index) => (
              <Link
                key={label}
                to={to}
                {...externalLinkProps}
                className="home-anim-pop flex min-w-0 flex-col items-center gap-[7px] rounded-2xl px-1 py-0 text-center active:scale-95"
                style={{ '--home-anim-delay': `${120 + index * 60}ms` }}
              >
                <span className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[15px] bg-[#fbf2ea] text-[#f26522]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate text-[11px] font-extrabold text-[#3a3e46]">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {heroProducts.length > 0 ? (
          <section className="overflow-hidden rounded-[24px] border border-[#eeeff3] bg-white shadow-none">
            <div>
              <Link
                to="/top-deals"
                {...externalLinkProps}
                className="home-shine-host home-anim-fade-up flex min-h-[168px] overflow-hidden bg-white text-slate-950 active:scale-[0.99]"
              >
                <div className="flex flex-1 flex-col justify-between gap-3 p-[18px]">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[1px] text-[#f26522]">Sélection du jour</p>
                    <p className="mt-1.5 text-[19px] font-black leading-tight text-[#1b1d22]">Offres à suivre aujourd’hui</p>
                  </div>
                  <span className="inline-flex min-h-10 w-fit items-center gap-1 rounded-full bg-[#1b1d22] px-4 text-xs font-black text-white">
                    Voir les offres <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="grid h-[150px] w-[150px] shrink-0 grid-cols-2 gap-[6px] p-[9px]">
                  {heroProducts.slice(0, 4).map((product, idx) => (
                    <div key={`hero-thumb-${product._id || idx}`} className="overflow-hidden rounded-[10px] bg-gray-100">
                      <PreviewableImage
                        product={product}
                        src={resolveProductPrimaryImage(product)}
                        images={resolveProductImageSet(product)}
                        alt={product.title || 'Produit'}
                        className="h-full w-full object-cover"
                        loading={idx < 2 ? 'eager' : 'lazy'}
                        reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                        showHint={false}
                      />
                    </div>
                  ))}
                </div>
              </Link>
            </div>
          </section>
        ) : null}

        {/* Mobile Categories Module */}
        <section className="hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-sm max-[375px]:p-2.5">
          <div className="mb-2.5 max-[375px]:mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 max-[375px]:gap-1.5">
              <div className="inline-flex h-7 w-7 max-[375px]:h-6 max-[375px]:w-6 items-center justify-center rounded-xl bg-[#e85d00] shadow-sm">
                <LayoutGrid className="h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3 text-white" />
              </div>
              <p className="text-xs max-[375px]:text-[11px] font-black text-gray-900">{t('home.allCategories', 'Toutes catégories')}</p>
            </div>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 max-[375px]:px-2 py-1.5 max-[375px]:py-1 text-[11px] max-[375px]:text-[10px] font-black text-gray-500 ring-1 ring-gray-200 transition-colors active:scale-95"
            >
              Tout voir <ChevronRight className="h-3 w-3 max-[375px]:h-2.5 max-[375px]:w-2.5" />
            </button>
          </div>
          <div className="flex gap-2 max-[375px]:gap-1.5 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
            <Link
              to="/products"
              {...externalLinkProps}
              className="inline-flex items-center gap-1.5 max-[375px]:gap-1 px-3.5 max-[375px]:px-3 py-2 max-[375px]:py-1.5 rounded-full bg-[#e85d00] text-white text-xs max-[375px]:text-[11px] font-black leading-none whitespace-nowrap shadow-sm tap-feedback transition-transform"
            >
              <LayoutGrid className="w-3.5 h-3.5 max-[375px]:w-3 max-[375px]:h-3" />
              <span className="block truncate">{t('home.all', 'Tout')}</span>
            </Link>
            {categoryGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Link
                  key={group.id}
                  to={`/categories/${group.options?.[0]?.value || ''}`}
                  className="inline-flex min-w-0 max-w-[138px] max-[375px]:max-w-[124px] items-center justify-center gap-1.5 max-[375px]:gap-1 px-3.5 max-[375px]:px-3 py-2 max-[375px]:py-1.5 rounded-full border border-gray-200 bg-white text-xs max-[375px]:text-[11px] font-black leading-none text-gray-800 whitespace-nowrap shadow-sm active:scale-95 transition-transform"
                  title={group.label}
                >
                  {Icon && (
                    <span className="inline-flex h-5 w-5 max-[375px]:h-[18px] max-[375px]:w-[18px] items-center justify-center rounded-full bg-gray-100 text-[#e85d00] flex-shrink-0 mx-auto">
                      <Icon className="w-3.5 h-3.5 max-[375px]:w-3 max-[375px]:h-3" />
                    </span>
                  )}
                  <span className="block min-w-0 truncate">{group.label.split(' & ')[0]}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Mobile Hero */}
        <section className="hidden relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-sm min-h-[170px] max-[375px]:min-h-[155px]">
          {heroBanner && (
            <div className="absolute inset-0">
              <img src={heroBanner} alt="Bannière HDMarket" className="h-full w-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-black/55" />
            </div>
          )}
          {!heroBanner && <div className="absolute inset-0 bg-neutral-900" />}
          <div className="relative z-10 flex h-full flex-col justify-between p-4 max-[375px]:p-3 text-white">
            <div>
              <div className="mb-2 max-[375px]:mb-1.5 inline-flex items-center gap-1.5 max-[375px]:gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 max-[375px]:px-2 py-1 max-[375px]:py-0.5 text-[10px] font-semibold">
                <Star className="h-3 w-3 max-[375px]:h-2.5 max-[375px]:w-2.5" fill="currentColor" />
                HDMarket CG
              </div>
              <h1 className="text-lg max-[375px]:text-base font-black leading-tight">
                {t('home.localMarket', 'Le marché local.')}
                <span className="block text-neutral-200">{t('home.simplified', 'Simplifié.')}</span>
              </h1>
              <p className="mt-1.5 max-[375px]:mt-1 text-xs max-[375px]:text-[11px] text-neutral-200">
                {t('home.heroSubMobile', 'Livraison flexible. Paiement en tranche. Sécurisé.')}
              </p>
            </div>
            <div className="mt-3 max-[375px]:mt-2.5 flex items-center gap-2 max-[375px]:gap-1.5">
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center rounded-xl bg-white px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-neutral-950 shadow-sm transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98]"
              >
                Explorer <ChevronRight className="ml-1 h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3" />
              </Link>
              {sellingEnabled && (
                <Link
                  to="/my"
                  className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
                >
                  <Zap className="mr-1 h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3" />
                  Publier
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Buyer or Seller callout */}
        <div className="hidden items-center justify-center gap-2 max-[375px]:gap-1.5 py-2.5 max-[375px]:py-2 px-3 max-[375px]:px-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80">
          <ShoppingBag className="w-4 h-4 max-[375px]:w-3.5 max-[375px]:h-3.5 text-neutral-800 flex-shrink-0" />
          <span className="text-xs max-[375px]:text-[11px] text-gray-700 text-center">
            {commerceCallout} <span className="font-semibold text-neutral-700">{t('home.youChoose', 'vous choisissez')}</span>.
          </span>
          <Tag className="w-4 h-4 max-[375px]:w-3.5 max-[375px]:h-3.5 text-neutral-800 flex-shrink-0" />
        </div>

        {/* Compact Promo Banner */}
        {hasPromoAsset && (() => {
          const activeBanner = promoBannerMobile || promoBanner;
          const bannerSrc = isPromoActive ? activeBanner : defaultPromoBanner;
          const bannerLink = isPromoActive ? promoBannerLink : '/products';
          const img = <img src={bannerSrc} alt="Promo" className="h-full w-full object-contain bg-white p-1" loading="eager" />;
          const cls = "hidden w-full overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm aspect-[16/9] max-h-[220px] max-[375px]:max-h-[190px]";
          if (bannerLink?.startsWith('/')) return <Link to={bannerLink} {...externalLinkProps} className={cls}>{img}</Link>;
          if (bannerLink) return <a href={bannerLink} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>;
          return <div className={cls}>{img}</div>;
        })()}

        {/* Flash Deals Horizontal Strip */}
        {!(highlightLoading && flashDealsLoading) && displayFlashDeals.length > 0 && (
          <section ref={secondarySectionsRef}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="home-anim-pulse grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#1b1d22]">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">{t('home.flashDeals', 'Flash Deals')}</h2>
              </div>
              <Link to="/top-deals" {...externalLinkProps} className="text-xs font-semibold text-neutral-800 flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4" style={scrollStyle}>
              {displayFlashDeals.map((product, idx) => (
                <Link
                  key={`flash-${product._id}-${idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="home-anim-fade-up flex w-[160px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#eeeff3] bg-white p-2 active:scale-[0.97] transition-transform"
                  style={{ '--home-anim-delay': `${idx * 70}ms` }}
                >
                  <div className="relative h-[120px] w-full overflow-hidden rounded-[14px] bg-[#f0f1f5]">
                    <PreviewableImage
                      product={product}
                      src={resolveProductPrimaryImage(product)}
                      images={resolveProductImageSet(product)}
                      alt={product.title}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                      reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                      showHint={false}
                    />
                    {product.flashPromo?.endDate && (
                      <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        {formatCountdown(product.flashPromo.endDate, flashNow)}
                      </span>
                    )}
                    {product.discount > 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[#f26522] px-2 py-1 text-[10px] font-black text-white">
                        -{product.discount}%
                      </span>
                    )}
                    {isInstallmentOfferActive(product) && (
                      <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                        <Clock className="h-2.5 w-2.5" />
                        Tranche
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-col px-1 pb-1 pt-2">
                    <p className="truncate text-[13px] font-extrabold text-[#1b1d22]">{product.title}</p>
                    <p className="mt-0.5 text-[15px] font-black text-[#f26522]">
                      {Number(product.promoPrice ?? product.price ?? 0).toLocaleString()} F
                    </p>
                    {product.priceBeforeDiscount > product.price && (
                      <p className="text-[11.5px] text-[#a0a5af] line-through">
                        {Number(product.priceBeforeDiscount).toLocaleString()} F
                      </p>
                    )}
                    {Number(product.promoSavedAmount || 0) > 0 && (
                      <p className="text-[10px] text-neutral-600 font-semibold">
                        {t('home.saveLabel', 'Éco')}: {formatPrice(product.promoSavedAmount)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ⚡ Flash Sales — Countdown Deals (Proposal 2) */}
        {!activeFlashSalesLoading && activeFlashSales.length > 0 && (
          <motion.section {...scrollReveal(reduceMotionHome)} className="hidden rounded-2xl border border-red-100 bg-red-50/40 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500">
                  <Zap size={14} className="text-white fill-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">
                  {t('home.flashSalesTitle', '⚡ Bons Plans Flash')}
                </h2>
              </div>
              <Link to="/flash-sales" className="text-xs font-semibold text-red-600">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="inline h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
              {activeFlashSales.map((fs) => (
                <FlashSaleCard key={fs._id} flashSale={fs} compact />
              ))}
            </div>
          </motion.section>
        )}

        {/* Boutiques en promo cette semaine */}
        {shouldLoadSecondarySections && (!promoShopsLoading || promoShops.length > 0) && (
          <section className="hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-500 rounded-lg flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('home.promoShopsWeek', 'Boutiques en promo cette semaine')}</h2>
              </div>
            </div>
            {promoShops.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                {promoShops.slice(0, 8).map((shop) => (
                  <Link
                    key={`promo-shop-mobile-${shop._id}`}
                    to={buildShopPath(shop)}
                    className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[180px]"
                  >
                    <img
                      src={shop.shopLogo || '/api/placeholder/40/40'}
                      alt={shop.shopName}
                      className="w-9 h-9 rounded-lg object-cover border border-gray-100"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{shop.shopName}</p>
                      <p className="text-[10px] text-neutral-600 font-semibold">
                        {shop.activePromoCountNow || shop.promoCountThisWeek} promo(s)
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">{t('home.noPromoShopsWeek', 'Aucune boutique en promo cette semaine.')}</p>
            )}
          </section>
        )}

        {/* Top ventes par ville (aujourd'hui) */}
        {shouldLoadSecondarySections && hasUserCity && (
          <section className="hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-800 rounded-lg flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('home.topSalesInCityToday', `Top ventes à ${effectiveUserCity} aujourd'hui`).replace('{city}', effectiveUserCity || '')}</h2>
              </div>
              <Link
                to={`/products?city=${encodeURIComponent(effectiveUserCity)}`}
                {...externalLinkProps}
                className="text-xs font-semibold text-[#0A0A0A] flex items-center"
              >
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            {topSalesCityTodayLoading ? (
              <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`city-sales-mobile-skeleton-${idx}`} className="w-[140px] flex flex-col rounded-xl overflow-hidden">
                    <div className="w-full aspect-square animate-pulse bg-gray-100" />
                    <div className="h-12 animate-pulse bg-gray-100 rounded-b-xl mt-1" />
                  </div>
                ))}
              </div>
            ) : topSalesCityTodayProducts.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                {topSalesCityTodayProducts.slice(0, 8).map((product, idx) => (
                  <Link
                    key={`city-sales-mobile-${product._id}-${idx}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex-shrink-0 w-[140px] flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform"
                  >
                    <div className="relative w-full aspect-square min-h-0 overflow-hidden bg-gray-100 rounded-t-xl">
                      <PreviewableImage
                        product={product}
                        src={resolveProductPrimaryImage(product)}
                        images={resolveProductImageSet(product)}
                        alt={product.title}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                        reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                        showHint={false}
                      />
                      <span className="absolute top-1.5 right-1.5 rounded-md bg-neutral-900/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        {Number(product.totalSoldToday || 0)} vendu(s)
                      </span>
                    </div>
                    <div className="p-2 flex flex-col min-h-0">
                      <p className="text-[11px] text-gray-700 font-medium truncate">{product.title}</p>
                      <p className="text-xs font-bold text-gray-900">{Number(product.price || 0).toLocaleString()} F</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">{t('home.noSalesTodayInCity', `Aucune vente enregistrée aujourd'hui à ${effectiveUserCity}.`).replace('{city}', effectiveUserCity || '')}</p>
            )}
          </section>
        )}

        {/* Best Sellers Strip */}
        {!topSalesLoading && topSalesProducts.length > 0 && (
          <section className="order-[0]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#1b1d22]">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">
                  📍 Top ventes à {effectiveUserCity || 'Brazzaville'}
                </h2>
              </div>
              <Link to="/top-sales" {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4" style={scrollStyle}>
              {topSalesProducts.slice(0, 6).map((product, idx) => (
                <Link
                  key={`bestseller-${product._id}-${idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="flex w-[150px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#eeeff3] bg-white p-2 active:scale-[0.97] transition-transform"
                >
                  <div className="relative h-[110px] w-full overflow-hidden rounded-[14px] bg-[#f0f1f5]">
                    <PreviewableImage
                      product={product}
                      src={resolveProductPrimaryImage(product)}
                      images={resolveProductImageSet(product)}
                      alt={product.title}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                      reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                      showHint={false}
                    />
                    <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#1b1d22] text-[11px] font-black text-white">{idx + 1}</span>
                    {isInstallmentOfferActive(product) && (
                      <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                        <Clock className="h-2.5 w-2.5" />
                        Tranche
                      </span>
                    )}
                  </div>
                  <div className="flex min-h-0 flex-col px-1 pb-1 pt-2">
                    <p className="truncate text-[13px] font-extrabold text-[#1b1d22]">{product.title}</p>
                    <p className="mt-0.5 text-[15px] font-black text-[#f26522]">{Number(product.price || 0).toLocaleString()} F</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Verified Shops Strip */}
        {!verifiedLoading && verifiedShops.length > 0 && (
          <section className="order-[7]">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#1b1d22]">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">{t('home.verifiedShops', 'Boutiques vérifiées')}</h2>
              </div>
              <Link to="/shops/verified" {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {verifiedShops.slice(0, 3).map((shop) => (
                <Link
                  key={shop._id}
                  to={buildShopPath(shop)}
                  className="flex items-center gap-3 rounded-[20px] border border-[#eeeff3] bg-white p-3 active:scale-[0.98] transition-transform"
                >
                  <div className="relative h-[52px] w-[52px] shrink-0 overflow-visible rounded-full bg-[#f0f1f5]">
                    <img
                      src={shop.shopLogo || '/api/placeholder/40/40'}
                      alt={shop.shopName}
                      className="absolute inset-0 h-full w-full rounded-full object-cover object-center"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-[2.5px] border-white bg-[#00a860] text-[10px] font-black text-white">✓</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-black text-[#1b1d22]">{shop.shopName}</p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold text-[#8a8f99]">{shop.productCount || 0} {t('home.listings', 'annonces')} · {shop.city || effectiveUserCity || 'Brazzaville'}</p>
                  </div>
                  <span className="rounded-full bg-[#fbf2ea] px-3 py-2 text-[12px] font-extrabold text-[#f26522]">Visiter</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* City section: connected user's city + products + sellers from same city */}
        {(() => {
          const firstCityWithData = cityList.find((c) => (cityHighlights[c] || []).length > 0);
          const firstFallbackCityWithData =
            cityList.find((cityName) => {
              const normalizedCity = normalizeCityName(cityName);
              return (cityFallbackProductsByCity.get(normalizedCity) || []).length > 0;
            }) || null;
          const anyFallbackCityKey = cityFallbackProductsByCity.keys().next().value || null;

          // Prefer connected user's city when set (show their city even if no data yet)
          const rawDisplayCity =
            effectiveUserCity && (cityList.length === 0 || cityList.includes(effectiveUserCity))
              ? effectiveUserCity
              : firstCityWithData || firstFallbackCityWithData || anyFallbackCityKey;
          const normalizedDisplayCity = normalizeCityName(rawDisplayCity);
          const highlightCityKey =
            Object.keys(cityHighlights).find(
              (key) => normalizeCityName(key) === normalizedDisplayCity
            ) || rawDisplayCity;
          const highlightCityProducts = highlightCityKey
            ? (cityHighlights[highlightCityKey] || [])
            : [];
          const fallbackCityProducts = normalizedDisplayCity
            ? (cityFallbackProductsByCity.get(normalizedDisplayCity) || [])
            : [];
          const fallbackCityLabel =
            resolveProductCity(fallbackCityProducts[0]) ||
            resolveProductCity(highlightCityProducts[0]) ||
            '';
          const displayCity =
            cityList.find((cityName) => normalizeCityName(cityName) === normalizedDisplayCity) ||
            (typeof highlightCityKey === 'string' ? highlightCityKey : '') ||
            fallbackCityLabel ||
            rawDisplayCity;
          const cityProds = (highlightCityProducts.length > 0 ? highlightCityProducts : fallbackCityProducts).slice(0, 8);
          const uniqueSellers = [];
          const seenIds = new Set();
          for (const p of cityProds) {
            const u = p.user;
            const uid = u?._id || u?.id;
            if (uid && !seenIds.has(String(uid)) && u?.accountType === 'shop') {
              seenIds.add(String(uid));
              uniqueSellers.push(u);
            }
          }
          if (!displayCity) return null;
          return (
            <section className="hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-neutral-800 rounded-lg flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">{displayCity}</h2>
                </div>
                <Link to={`/cities?city=${encodeURIComponent(displayCity)}`} {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] flex items-center">
                  Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
                </Link>
              </div>
              {displayCity && cityProds.length === 0 && uniqueSellers.length === 0 && (
                <p className="text-xs text-gray-500 py-2">
                  Aucune annonce dans votre ville pour le moment.{' '}
                  <Link to={`/cities?city=${encodeURIComponent(displayCity)}`} {...externalLinkProps} className="text-neutral-800 font-medium">
                    Explorer {displayCity}
                  </Link>
                </p>
              )}
              {uniqueSellers.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                  {uniqueSellers.slice(0, 12).map((seller) => {
                    const shopName = seller.shopName || seller.name || 'Vendeur';
                    const photo = seller.shopLogo || null;
                    const slug = seller.slug;
                    const href = slug ? buildShopPath(seller) : null;
                    const avatar = (
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                        {photo ? (
                          <img src={photo} alt={shopName} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    );
                    return href ? (
                      <Link
                        key={seller._id || seller.id}
                        to={href}
                        className="active:scale-[0.97] transition-transform"
                        title={shopName}
                      >
                        {avatar}
                      </Link>
                    ) : (
                      <div key={seller._id || seller.id} title={shopName}>
                        {avatar}
                      </div>
                    );
                  })}
                </div>
              )}
              {cityProds.length > 0 && (
                <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                  {cityProds.map((product, idx) => (
                    <Link
                      key={`city-m-${product._id}-${idx}`}
                      to={buildHomeProductLink(product)}
                      {...externalLinkProps}
                      className="flex-shrink-0 w-[140px] flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform"
                    >
                      <div className="relative w-full aspect-square min-h-0 overflow-hidden bg-gray-100 rounded-t-xl">
                        <PreviewableImage
                          product={product}
                          src={resolveProductPrimaryImage(product)}
                          images={resolveProductImageSet(product)}
                          alt={product.title}
                          className="w-full h-full object-cover object-center"
                          loading="lazy"
                          reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                          showHint={false}
                        />
                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-white/90 text-gray-600">
                          {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                        </span>
                        {isInstallmentOfferActive(product) && (
                          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                            <Clock className="h-2.5 w-2.5" />
                            Tranche
                          </span>
                        )}
                      </div>
                      <div className="p-2 flex flex-col min-h-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{Number(product.price || 0).toLocaleString()} F</p>
                        <p className="text-[10px] text-gray-500 truncate">{product.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        {/* Compact Sort Chips */}
        <div className="hidden gap-2 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
          {[
            { value: 'new', label: 'Nouveautés' },
            { value: 'price_asc', label: 'Prix ↑' },
            { value: 'price_desc', label: 'Prix ↓' },
            { value: 'discount', label: 'Promos' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { setSort(option.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                sort === option.value
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
          <input
            type="checkbox"
            checked={installmentOnlyFilter}
            onChange={(e) => {
              setInstallmentOnlyFilter(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-800 focus:ring-neutral-500"
          />
          Afficher uniquement les produits en tranche
        </label>
        {hasUserCity && (
          <label className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={nearMeOnlyFilter}
              onChange={(e) => {
                setNearMeOnlyFilter(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-neutral-300 text-neutral-800 focus:ring-neutral-500"
            />
            {t('home.onlyMyCity', 'Voir uniquement dans ma ville')}
          </label>
        )}

        {/* Wholesale section — always reserve space to prevent scroll jump */}
        <motion.section {...scrollReveal(reduceMotionHome)} className="order-[1] isolate" style={{ minHeight: shouldLoadSecondarySections ? undefined : 220 }}>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">{t('home.wholesaleTitle', 'Vente en gros')}</h2>
                    <span className="shrink-0 rounded-full bg-[#e7f8ef] px-2 py-1 text-[10.5px] font-black uppercase tracking-wide text-[#00a860]">B2B</span>
                  </div>
                </div>
              </div>
              <Link to="/products?wholesaleOnly=true" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-emerald-700 active:scale-95">
                {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          {!shouldLoadSecondarySections ? (
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4" style={scrollStyle}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`ws-reserve-${i}`} className="h-[220px] w-[160px] shrink-0 animate-pulse rounded-[20px] bg-[#f0f1f5]" />
              ))}
            </div>
          ) : wholesaleLoading && !wholesaleProducts.length ? (
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4" style={scrollStyle}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`wholesale-skeleton-${index}`} className="h-[220px] w-[160px] shrink-0 animate-pulse overflow-hidden rounded-[20px] bg-[#f0f1f5]" />
              ))}
            </div>
          ) : wholesaleProducts.length > 0 ? (
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar max-[375px]:-mx-4 max-[375px]:px-4" style={scrollStyle}>
              {wholesaleProducts.slice(0, 8).map((product) => {
                const minQty = Number(product?.wholesaleMinQty || product?.wholesaleTiers?.[0]?.minQty || 2);
                const wholesalePrice = Number(product?.wholesalePrice || product?.wholesaleTiers?.[0]?.price || product?.price || 0);
                return (
                  <Link key={`wholesale-mobile-${product._id}`} to={buildHomeProductLink(product)} {...externalLinkProps} className="flex w-[160px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#eeeff3] bg-white p-2 active:scale-[0.98]">
                    <div className="relative h-[120px] overflow-hidden rounded-[14px] bg-[#f0f1f5]">
                      <PreviewableImage product={product} src={resolveProductPrimaryImage(product)} images={resolveProductImageSet(product)} alt={product.title} className="h-full w-full object-cover" loading="lazy" reportContext={buildImageReportContext(product, buildHomeProductLink(product))} showHint={false} />
                      {isInstallmentOfferActive(product) && (
                        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                          <Clock className="h-2.5 w-2.5" />
                          Tranche
                        </span>
                      )}
                    </div>
                    <div className="px-1 pb-2 pt-2">
                      <p className="truncate text-[13px] font-extrabold text-[#1b1d22]">{product.title}</p>
                      <p className="mt-0.5 text-[15px] font-black text-[#f26522]">{formatPrice(wholesalePrice)}</p>
                    </div>
                    <div className="-mx-2 mt-auto flex items-center justify-between gap-1.5 bg-[#e7f8ef] px-3 py-2">
                      <span className="truncate text-[11.5px] font-black text-[#00a860]">Prix de gros</span>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#00a860]">x{minQty}+</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              {t('home.noWholesaleProducts', 'Aucun produit en vente en gros actuellement.')}
            </p>
          )}
          </div>
        </motion.section>

        {/* Installment section — always reserve space to prevent scroll jump */}
        <motion.section {...scrollReveal(reduceMotionHome)} ref={installmentSectionRef} className="order-[2] isolate" style={{ minHeight: shouldLoadSecondarySections ? undefined : 220 }}>
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-[16px] font-black leading-snug tracking-[-0.02em] text-[#1b1d22] sm:text-[18px]">
                {t('home.installmentProducts', 'Paiement par tranche')}
              </h2>
                    <span className="shrink-0 rounded-full bg-[#ebf4fd] px-2 py-1 text-[10.5px] font-black uppercase tracking-wide text-[#0b87d4]">Flex</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] font-semibold text-[#8a8f99]">
                {t('home.installmentSubtitle', 'Payez progressivement, plus de flexibilité.')}
              </p>
                </div>
            </div>
              <Link to="/products?installmentOnly=true" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-sky-700 active:scale-95">
              {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {!shouldLoadSecondarySections ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`is-reserve-${i}`} className="h-[224px] w-[168px] shrink-0 animate-pulse rounded-[20px] bg-[#f0f1f5]" />
              ))}
            </div>
          ) : installmentLoading && !activeInstallmentProducts.length ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`installment-skeleton-${index}`} className="h-[224px] w-[168px] shrink-0 animate-pulse rounded-[20px] bg-[#f0f1f5]" />
              ))}
            </div>
          ) : activeInstallmentProducts.length > 0 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {activeInstallmentProducts
                .slice(0, 8)
                .map((product) => {
                  const firstPayment = getInstallmentFirstPaymentAmount(product);
                  return (
                    <Link key={`installment-mobile-${product._id}`} to={buildHomeProductLink(product)} {...externalLinkProps} className="flex w-[168px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#eeeff3] bg-white p-2 active:scale-[0.98]">
                      <div className="relative h-[120px] overflow-hidden rounded-[14px] bg-[#f0f1f5]">
                        <PreviewableImage
                          product={product}
                          src={resolveProductPrimaryImage(product)}
                          images={resolveProductImageSet(product)}
                          alt={product.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                          showHint={false}
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#f26522] px-2 py-1 text-[10px] font-black text-white">Nouveau</span>
                      </div>
                      <div className="px-1 pb-2 pt-2">
                        <p className="truncate text-[13px] font-extrabold text-[#1b1d22]">{product.title}</p>
                        <p className="mt-0.5 text-[15px] font-black text-[#f26522]">{formatPrice(product?.price || 0)}</p>
                      </div>
                      <div className="-mx-2 border-t border-[#d8eafa] bg-[#ebf4fd] px-3 py-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="inline-flex min-w-0 items-center gap-1 text-[10.5px] font-black uppercase tracking-wide text-[#0b87d4]">
                            <CreditCard className="h-3 w-3 shrink-0" />
                            <span className="truncate">{t('home.firstInstallmentPayment', 'Premier paiement')}</span>
                          </span>
                          {product?.installmentDuration ? (
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#0b87d4] shadow-none">{product.installmentDuration}j</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[14px] font-black text-[#0b87d4]">
                          {firstPayment > 0
                            ? formatPrice(firstPayment)
                            : t('home.installmentDetails', 'Voir les modalités')}
                        </p>
                      </div>
                    </Link>
                  );
                })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('home.noInstallmentProducts', 'Aucun produit en tranche disponible actuellement.')}</p>
          )}
          </div>
        </motion.section>

        {/* All Products Grid */}
        <section className="order-[3]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[#1b1d22]">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">{t('home.forYou', 'Pour vous')}</h2>
                <p className="text-[12px] font-semibold text-[#8a8f99]">
                  <span className="tabular-nums">{formatCount(totalProducts)}</span> {t('home.listings', 'annonces')}{hasUserCity ? ' · près de vous' : ''}
                </p>
              </div>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-50 text-neutral-700 font-semibold text-sm hover:bg-neutral-100 active:scale-[0.98] transition-all"
            >
              Voir tout
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            </Link>
          </div>

          {productsError ? (
            <NetworkFallbackCard
              title="Unable to load data."
              message={productsError}
              onRetry={loadProducts}
              retryLabel="Retry"
              refreshLabel="Refresh page"
            />
          ) : loading && items.length === 0 ? (
            <ShimmerSkeleton rows={3} />
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {items.map((product, index) => (
                  <div
                    key={`product-${product._id}-${index}`}
                    className="home-anim-fade-up w-full h-full"
                    style={{ '--home-anim-delay': `${(index % 8) * 45}ms` }}
                  >
                    <ProductCard p={product} productLink={buildHomeProductLink(product)} homeFeed />
                  </div>
                ))}
              </div>
              <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px w-full" />
              {loading && page > 1 && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {loadMoreError && !loading && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                  <p className="text-xs font-medium text-amber-800">{loadMoreError}</p>
                  <button
                    type="button"
                    onClick={loadProducts}
                    className="mt-2 inline-flex items-center rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 active:scale-95"
                  >
                    Retry
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">{t('home.noProductsFound', 'Aucun produit trouvé')}</p>
              <button
                onClick={() => { setCategory(''); setSort('new'); setPage(1); }}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-full active:scale-95"
              >
                {t('home.reset', 'Réinitialiser')}
              </button>
            </div>
          )}
        </section>

        {/* Discover More Quick Links */}
        <section className="order-[4] pb-2">
          <h3 className="mb-3 text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">{t('home.discoverMore', 'Découvrir plus')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <Link
              to="/top-favorites"
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <Heart className="h-5 w-5 text-[#f26522]" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.topFavorites', 'Top Favoris')}</span>
            </Link>
            <Link
              to="/top-ranking"
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <Star className="h-5 w-5 text-[#f26522]" fill="currentColor" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.topRated', 'Top Notés')}</span>
            </Link>
            <Link
              to="/top-new"
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <Sparkles className="h-5 w-5 text-[#f26522]" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.newProducts', 'Neufs')}</span>
            </Link>
            <Link
              to="/top-used"
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <RefreshCcw className="h-5 w-5 text-[#f26522]" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.usedProducts', 'Occasion')}</span>
            </Link>
            <Link
              to="/certified-products"
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <Shield className="h-5 w-5 text-[#f26522]" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.certified', 'Certifiés')}</span>
            </Link>
            <Link
              to="/cities"
              {...externalLinkProps}
              className="flex flex-col items-center gap-2 rounded-[18px] border border-[#eeeff3] bg-white p-3 active:scale-95 transition-transform"
            >
              <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#fbf2ea]">
                <MapPin className="h-5 w-5 text-[#f26522]" />
              </div>
              <span className="text-[12px] font-extrabold text-[#3a3e46] text-center">{t('home.cities', 'Villes')}</span>
            </Link>
          </div>
        </section>
      </main>
    );
  };

  // === DESKTOP WIDE MULTI-ZONE LAYOUT (Proposal A) ===
  const renderDesktopHome = () => {
    const fallbackDeals = [
      ...highlights.topDeals.slice(0, 4),
      ...discountProducts.filter(p => !highlights.topDeals.some(d => d._id === p._id)).slice(0, 4)
    ].slice(0, 4);
    const displayFlashDeals = (flashDeals.length ? flashDeals : fallbackDeals).slice(0, 4);

    const topProductsTabData = {
      favorites: { items: highlights.favorites, icon: Heart, label: t('home.topFavorites', 'Top Favoris'), link: '/top-favorites', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-600' },
      topRated: { items: highlights.topRated, icon: Star, label: t('home.topRated', 'Top Notés'), link: '/top-ranking', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-600' },
      newProducts: { items: highlights.newProducts, icon: Sparkles, label: t('home.newProducts', 'Neufs'), link: '/top-new', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-600' },
      usedProducts: { items: highlights.usedProducts, icon: RefreshCcw, label: t('home.usedProducts', 'Occasion'), link: '/top-used', iconColor: 'text-neutral-600', bgColor: 'bg-neutral-600' }
    };
    const activeTabData = topProductsTabData[topProductsTab] || topProductsTabData.favorites;
    const greeting = getGreetingInfo(user);

    // Services mis en avant : livraison offerte, Acheter Pour Moi, colis —
    // une seule rangée de cartes compactes au lieu de bannières empilées.
    const desktopServiceCards = [
      showFullPaymentHomeBanner
        ? {
            key: 'free-delivery',
            badge: 'Livraison offerte',
            title: 'Livraison offerte',
            subtitle: fullPaymentBannerText,
            to: '/products',
            icon: Truck,
            tile: 'bg-emerald-600',
            badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
            hover: 'hover:border-emerald-200'
          }
        : null,
      buyForMeEnabled
        ? {
            key: 'buy-for-me',
            badge: 'Nouveau',
            title: 'Acheter Pour Moi',
            subtitle: 'Un livreur fait vos courses (supermarché, pharmacie, restaurant…) et vous livre',
            to: '/buy-for-me',
            icon: ShoppingBag,
            tile: 'bg-violet-600',
            badgeClass: 'bg-violet-50 text-violet-700 ring-violet-100',
            hover: 'hover:border-violet-200'
          }
        : null,
      parcelDeliveryEnabled
        ? {
            key: 'parcels',
            badge: 'Course à la demande',
            title: 'Envoyer un colis',
            subtitle: 'Un livreur récupère et livre où vous voulez',
            to: '/parcels/new',
            icon: Package,
            tile: 'bg-sky-600',
            badgeClass: 'bg-sky-50 text-sky-700 ring-sky-100',
            hover: 'hover:border-sky-200'
          }
        : null
    ].filter(Boolean);
    const serviceGridClass =
      desktopServiceCards.length >= 3
        ? 'sm:grid-cols-2 xl:grid-cols-3'
        : desktopServiceCards.length === 2
          ? 'sm:grid-cols-2'
          : 'grid-cols-1';

    return (
      <main className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-6 lg:px-8 py-4 space-y-5">
        {greeting ? (
          <section className="flex flex-col divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0 dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex min-w-0 items-center gap-3 px-5 py-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff2e6] text-[#e85d00] ring-1 ring-gray-100 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-neutral-800">
                {greeting.isEvening ? <Moon size={20} /> : <Sun size={20} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black text-gray-900 dark:text-white">
                  {greeting.isEvening ? 'Bonsoir' : 'Bonjour'} {greeting.firstName} 👋
                </p>
                <p className="truncate text-xs font-medium capitalize text-gray-500 dark:text-neutral-400">
                  {greeting.dateLabel}
                </p>
              </div>
            </div>
            <Link
              to="/profile"
              className="group flex min-w-0 flex-1 items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 dark:hover:bg-neutral-900"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-100 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                    {t('home.deliveryAddress', 'Adresse de livraison')}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    hasDeliveryAddress ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {hasDeliveryAddress ? 'Adresse prête' : 'À compléter'}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm font-black text-slate-950 dark:text-white">
                  {connectedUserDeliveryAddressLabel}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-500 ring-1 ring-gray-200 transition group-hover:bg-[#e85d00] group-hover:text-white dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-800">
                Modifier <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
            <div className="flex items-center px-5 py-3 lg:py-0">
              <Link
                to="/top-deals"
                {...externalLinkProps}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E4] px-3.5 py-2 text-xs font-black text-[#e85d00] transition hover:bg-[#e85d00] hover:text-white dark:bg-orange-950/40 dark:text-orange-300"
              >
                <Sparkles size={13} />
                {greeting.isEvening ? 'Offres du soir' : 'Offres du jour'}
              </Link>
            </div>
          </section>
        ) : null}
        {desktopServiceCards.length ? (
          <section className={`grid gap-3 ${serviceGridClass}`}>
            {desktopServiceCards.map((card) => (
              <Link
                key={card.key}
                to={card.to}
                {...externalLinkProps}
                className={`group flex min-w-0 items-center gap-3.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 ${card.hover} dark:border-neutral-800 dark:bg-neutral-950`}
              >
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${card.tile}`}>
                  <card.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ${card.badgeClass}`}>
                    {card.badge}
                  </span>
                  <span className="mt-1 block truncate text-sm font-black text-slate-950 dark:text-white">{card.title}</span>
                  {card.subtitle ? (
                    <span className="block truncate text-xs font-medium text-gray-500 dark:text-neutral-400">{card.subtitle}</span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-neutral-600" />
              </Link>
            ))}
          </section>
        ) : null}
        {/* Category Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar items-center">
          <Link
            to="/products"
            {...externalLinkProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#e85d00] text-white text-sm font-black whitespace-nowrap shadow-sm hover:bg-[#e85f00] transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Tout
          </Link>
          {categoryGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.id}
                to={`/categories/${group.options?.[0]?.value || ''}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-black text-gray-800 whitespace-nowrap shadow-sm transition-colors hover:bg-gray-100"
              >
                {Icon && (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[#e85d00] flex-shrink-0 mx-auto">
                    <Icon className="w-4 h-4" />
                  </span>
                )}
                <span>{group.label.split(' & ')[0]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 text-sm font-black text-gray-500 whitespace-nowrap ring-1 ring-gray-200 hover:bg-orange-100 transition-colors"
          >
            Tout voir <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Buyer or Seller callout */}
        <div className="flex items-center justify-center gap-3 py-3 px-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
          <ShoppingBag className="w-5 h-5 text-neutral-800 flex-shrink-0" />
          <span className="text-sm text-gray-700 text-center">
            {commerceCallout} <span className="font-semibold text-neutral-700">{t('home.youChoose', 'vous choisissez')}</span>.
          </span>
          <Tag className="w-5 h-5 text-neutral-800 flex-shrink-0" />
        </div>

        {/* Zone 1: Hero (65%) + Flash Deals Panel (35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
          {/* Hero Banner */}
          <div className="flex flex-col gap-4">
            <section className="home-shine-host relative bg-neutral-900 rounded-2xl overflow-hidden shadow-sm" style={{ minHeight: '300px' }}>
              {heroBanner && (
                <div className="absolute inset-0">
                  <img src={heroBanner} alt="Bannière HDMarket" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-neutral-950/70" />
                </div>
              )}
              <div className="relative z-10 px-6 py-8 lg:py-10 text-left">
                <div className="home-anim-fade-up inline-flex items-center px-3 py-1.5 bg-white/15 rounded-full border border-white/30 mb-4 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-neutral-300 mr-1.5" fill="currentColor" />
                  <span className="text-xs text-white font-semibold">{t('nav.marketplacePremium', 'Marketplace HDMarket')}</span>
                </div>
                <h1 className="home-anim-fade-up text-3xl lg:text-4xl font-black text-white mb-3 leading-tight" style={{ '--home-anim-delay': '90ms' }}>
                  Votre Marché
                  <span className="block bg-neutral-300 bg-clip-text text-transparent">{t('home.digital', 'Digital')}</span>
                </h1>
                <p className="home-anim-fade-up text-sm text-neutral-200 mb-5 max-w-md leading-relaxed" style={{ '--home-anim-delay': '160ms' }}>
                  {desktopHeroDescription}
                </p>
                <div className="home-anim-fade-up flex gap-3" style={{ '--home-anim-delay': '240ms' }}>
                  {sellingEnabled && (
                    <Link to="/my" className="inline-flex items-center px-4 py-2.5 border border-white/25 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/15 transition-all text-sm shadow-sm active:scale-[0.99]">
                      <Zap className="w-4 h-4 mr-1.5" /> Publier
                    </Link>
                  )}
                  <Link to="/products" {...externalLinkProps} className="inline-flex items-center px-4 py-2.5 bg-white text-neutral-950 font-semibold rounded-xl hover:bg-neutral-100 transition-all text-sm shadow-sm active:scale-[0.99]">
                    Explorer <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Promo Banner (below hero, full width of left column) */}
            {promoBanner && (() => {
              const bannerSrc = isPromoActive ? (promoBanner || defaultPromoBanner) : defaultPromoBanner;
              const bannerLink = isPromoActive ? promoBannerLink : '/products';
              const img = <img src={bannerSrc} alt="Promo" className="h-full w-full object-contain bg-white p-1" loading="lazy" />;
              const cls = "block w-full overflow-hidden rounded-xl shadow-sm aspect-[21/7]";
              if (bannerLink?.startsWith('/')) return <Link to={bannerLink} {...externalLinkProps} className={cls}>{img}</Link>;
              if (bannerLink) return <a href={bannerLink} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>;
              return <div className={cls}>{img}</div>;
            })()}
          </div>

          {/* Flash Deals Panel */}
          <section className="apple-card p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="home-anim-pulse w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{t('home.flashDeals', 'Flash Deals')}</h2>
              </div>
              <Link to="/top-deals" {...externalLinkProps} className="text-xs font-semibold text-neutral-800 flex items-center hover:text-neutral-700">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            {highlightLoading && flashDealsLoading ? (
              <div className="grid grid-cols-2 gap-3 flex-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-xl aspect-square" />
                ))}
              </div>
            ) : displayFlashDeals.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 flex-1">
                {displayFlashDeals.map((product, idx) => (
                  <Link
                    key={`deal-panel-${product._id}-${idx}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="home-anim-fade-up group flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-neutral-200 transition-all"
                    style={{ '--home-anim-delay': `${idx * 80}ms` }}
                  >
                    <div className="relative w-full aspect-square min-h-0 overflow-hidden bg-gray-100 rounded-t-xl">
                      <PreviewableImage
                        product={product}
                        src={resolveProductPrimaryImage(product)}
                        images={resolveProductImageSet(product)}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                        showHint={false}
                      />
                      {product.flashPromo?.endDate && (
                        <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          {formatCountdown(product.flashPromo.endDate, flashNow)}
                        </span>
                      )}
                      {product.discount > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-neutral-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">-{product.discount}%</span>
                      )}
                      {isInstallmentOfferActive(product) && (
                        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-md bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                          <Clock className="h-2.5 w-2.5" />
                          Tranche
                        </span>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col flex-1 min-h-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{Number(product.promoPrice ?? product.price ?? 0).toLocaleString()} F</p>
                      {product.priceBeforeDiscount > product.price && (
                        <p className="text-[10px] text-gray-400 line-through">{Number(product.priceBeforeDiscount).toLocaleString()} F</p>
                      )}
                      {Number(product.promoSavedAmount || 0) > 0 && (
                        <p className="text-[10px] text-neutral-600 font-semibold mt-0.5">
                          Éco: {Number(product.promoSavedAmount).toLocaleString()} F
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                <Zap className="w-6 h-6 mr-2 text-gray-300" /> Aucun deal en cours
              </div>
            )}
          </section>
        </div>

        {/* Zone 2: Top ventes à votre ville (aujourd'hui) */}
        {shouldLoadSecondarySections && hasUserCity && effectiveUserCity && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-neutral-800 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Top ventes à {effectiveUserCity} aujourd&apos;hui</h2>
              </div>
              <Link
                to={`/products?city=${encodeURIComponent(effectiveUserCity)}`}
                {...externalLinkProps}
                className="text-sm font-semibold text-[#0A0A0A] flex items-center hover:text-[#111111]"
              >
                Voir tout <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </div>
            {topSalesCityTodayLoading ? (
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={`city-sales-desktop-skeleton-${idx}`} className="h-64 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : topSalesCityTodayProducts.length > 0 ? (
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
                {topSalesCityTodayProducts.slice(0, 5).map((product, idx) => (
                  <Link
                    key={`city-sales-desktop-${product._id}-${idx}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-neutral-200 transition-all"
                  >
                    <div className="relative w-full aspect-square min-h-0 overflow-hidden bg-gray-100">
                      <PreviewableImage
                        product={product}
                        src={resolveProductPrimaryImage(product)}
                        images={resolveProductImageSet(product)}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                        showHint={false}
                      />
                      <span className="absolute top-2 right-2 rounded-md bg-neutral-900/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {Number(product.totalSoldToday || 0)} vendu(s)
                      </span>
                      {isInstallmentOfferActive(product) && (
                        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          <Clock className="h-2.5 w-2.5" />
                          Tranche
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-h-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{product.title}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{formatPrice(product.price || 0)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucune vente enregistrée aujourd&apos;hui à {effectiveUserCity}.</p>
            )}
          </section>
        )}

        {/* Zone 3: Shops (35%) + Tabbed Top Products (65%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* Verified Shops Panel */}
          <section className="bg-neutral-50/60 rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-neutral-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{t('home.verifiedShops', 'Boutiques vérifiées')}</h2>
              </div>
              <Link to="/shops/verified" {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] hover:text-[#111111]">
                Voir tout
              </Link>
            </div>
            {verifiedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-200 rounded w-3/4" /><div className="h-2.5 bg-gray-200 rounded w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : verifiedShops.length > 0 ? (
              <div className="space-y-2">
                {verifiedShops.map((shop) => (
                  <Link
                    key={shop._id}
                    to={buildShopPath(shop)}
                    className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 hover:border-neutral-200 hover:shadow-sm transition-all p-3"
                  >
                    <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 border border-gray-100">
                      <img
                        src={shop.shopLogo || '/api/placeholder/48/48'}
                        alt={shop.shopName}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{shop.shopName}</p>
                      <p className="text-xs text-gray-500 truncate">{shop.shopAddress || 'Adresse non renseignée'}</p>
                    </div>
                    <span className="text-xs text-neutral-600 font-semibold whitespace-nowrap">{shop.productCount || 0} {t('home.listings', 'annonces')}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">{t('home.noVerifiedShops', 'Aucune boutique vérifiée')}</div>
            )}
          </section>

          {/* Tabbed Top Products Widget */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">{t('home.trending', 'Tendances')}</h2>
              <Link to={activeTabData.link} {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] hover:text-[#111111] flex items-center">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            {/* Tab buttons */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
              {Object.entries(topProductsTabData).map(([key, tab]) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTopProductsTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                      topProductsTab === key
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            {/* Tab content - 3 products in a row */}
            {highlightLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-xl aspect-square" />
                ))}
              </div>
            ) : activeTabData.items.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {activeTabData.items.slice(0, 3).map((product, index) => (
                  <Link
                    key={`trend-${topProductsTab}-${product._id}-${index}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="group flex flex-col bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-neutral-200 transition-all"
                  >
                    <div className="relative w-full aspect-square min-h-0 overflow-hidden bg-gray-100 rounded-t-xl">
                      <PreviewableImage
                        product={product}
                        src={resolveProductPrimaryImage(product)}
                        images={resolveProductImageSet(product)}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                        showHint={false}
                      />
                      <span className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ${
                        index === 0 ? 'bg-neutral-500' : index === 1 ? 'bg-gray-400' : 'bg-neutral-600'
                      }`}>
                        {index + 1}
                      </span>
                      {isInstallmentOfferActive(product) && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                          <Clock className="h-2.5 w-2.5" />
                          Tranche
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1 min-h-0">
                      <p className="text-sm font-medium text-gray-700 truncate group-hover:text-neutral-900 transition-colors">{product.title}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{formatPrice(product.price || 0)}</p>
                      {topProductsTab === 'favorites' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Heart className="w-3 h-3 text-neutral-500" fill="currentColor" />
                          <span>{product.favoritesCount || 0}</span>
                        </div>
                      )}
                      {topProductsTab === 'topRated' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Star className="w-3 h-3 text-neutral-400" fill="currentColor" />
                          <span className="font-semibold text-gray-700">{Number(product.ratingAverage || 0).toFixed(1)}</span>
                          <span>({product.ratingCount || 0})</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">{t('home.noProductsInCategory', 'Aucun produit dans cette catégorie')}</div>
            )}
          </section>
        </div>

        {shouldLoadSecondarySections && (
        <section className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-neutral-500 rounded-lg flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('home.promoShopsWeek', 'Boutiques en promo cette semaine')}</h2>
                <p className="text-xs text-gray-500">{t('home.activeOffers', 'Offres actives et remises en cours')}</p>
              </div>
            </div>
          </div>
          {promoShopsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`promo-shop-skeleton-${index}`} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : promoShops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {promoShops.slice(0, 8).map((shop) => (
                <Link
                  key={`promo-shop-desktop-${shop._id}`}
                  to={buildShopPath(shop)}
                  className="rounded-xl border border-neutral-100 bg-neutral-50/50 px-3 py-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={shop.shopLogo || '/api/placeholder/48/48'}
                      alt={shop.shopName}
                      className="w-11 h-11 rounded-lg object-cover border border-neutral-100"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{shop.shopName}</p>
                      <p className="text-xs text-neutral-700 font-semibold">
                        {shop.activePromoCountNow || shop.promoCountThisWeek} promo(s) actives
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('home.noPromoShopsWeek', 'Aucune boutique en promo cette semaine.')}</p>
          )}
        </section>
        )}

        <div className="space-y-5">
          {shouldLoadSecondarySections && (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Header */}
            <div className="relative flex items-center justify-between overflow-hidden border-b border-gray-100 bg-white px-5 py-4 text-gray-900">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-gray-900">{t('home.wholesaleTitle', 'Vente en gros')}</h2>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">B2B</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">{t('home.wholesaleSubtitle', 'Prix adaptés aux achats en quantité.')}</p>
                </div>
              </div>
              <Link to="/products?wholesaleOnly=true" className="group flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100">
                {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {wholesaleLoading && !wholesaleProducts.length ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`wdsk-${i}`} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                    <div className="aspect-[4/3] animate-pulse bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 animate-pulse rounded bg-gray-100 w-3/4" />
                      <div className="h-5 animate-pulse rounded bg-gray-100 w-1/3" />
                      <div className="h-3 animate-pulse rounded bg-gray-100 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : wholesaleProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {wholesaleProducts.slice(0, 5).map((product) => {
                  const minQty = Number(product?.wholesaleMinQty || product?.wholesaleTiers?.[0]?.minQty || 2);
                  const tierPrice = product?.wholesaleTiers?.[0]?.unitPrice || product?.price;
                  return (
                    <Link
                      key={`wholesale-dsk-${product._id}`}
                      to={buildHomeProductLink(product)}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                        <img
                          src={product.images?.[0] || '/placeholder.jpg'}
                          alt={product.title}
                          className="h-full w-full object-cover transition duration-400 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Wholesale badge */}
                        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                          <Tag className="h-3 w-3" />
                          GROS
                        </span>
                        {isInstallmentOfferActive(product) && (
                          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                            <Clock className="h-3 w-3" />
                            Tranche
                          </span>
                        )}
                        {/* Tier price badge */}
                        {tierPrice && tierPrice !== product.price && (
                          <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">
                            Dès {formatPrice(tierPrice)}/u
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex flex-col gap-1.5 p-3">
                        <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#e85d00] transition-colors">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-neutral-950">{formatPrice(product.price)}</span>
                          {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                            <span className="text-xs text-gray-400 line-through">{formatPrice(product.priceBeforeDiscount)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <ShoppingBag className="h-2.5 w-2.5" />
                            Min. {minQty} u.
                          </span>
                          {product.salesCount > 0 && (
                            <span className="text-[10px] text-gray-400">{product.salesCount} vendus</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="px-5 pb-5 text-sm text-gray-400">
                {t('home.noWholesaleProducts', 'Aucun produit en vente en gros actuellement.')}
              </p>
            )}
          </section>
          )}

          {shouldLoadSecondarySections && (
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {/* Header */}
            <div className="relative flex items-center justify-between overflow-hidden border-b border-gray-100 bg-white px-5 py-4 text-gray-900">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-white">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-gray-900">
                    {t('home.installmentProducts', 'Paiement par tranche')}
                  </h2>
                    <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-700">Flex</span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">
                    {t('home.installmentSubtitle', 'Payez progressivement avec plus de flexibilité.')}
                  </p>
                </div>
              </div>
              <Link to="/products?installmentOnly=true" className="group flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 transition hover:bg-sky-100">
                {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {installmentLoading && !activeInstallmentProducts.length ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={`idsk-${i}`} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                    <div className="aspect-[4/3] animate-pulse bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 animate-pulse rounded bg-gray-100 w-3/4" />
                      <div className="h-5 animate-pulse rounded bg-gray-100 w-1/3" />
                      <div className="h-3 animate-pulse rounded bg-gray-100 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activeInstallmentProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
                {activeInstallmentProducts
                  .slice(0, 5)
                  .map((product) => {
                    const duration = product?.installmentDuration || 0;
                    const firstPayment = getInstallmentFirstPaymentAmount(product);
                    return (
                      <Link
                        key={`installment-dsk-${product._id}`}
                        to={buildHomeProductLink(product)}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                      >
                        {/* Image */}
                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                          <img
                            src={product.images?.[0] || '/placeholder.jpg'}
                            alt={product.title}
                            className="h-full w-full object-cover transition duration-400 group-hover:scale-105"
                            loading="lazy"
                          />
                          {/* Installment badge */}
                          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                            <Clock className="h-3 w-3" />
                            {duration > 0 ? `${duration}J` : 'TRANCHE'}
                          </span>
                          {firstPayment > 0 && (
                            <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                              {t('home.firstInstallmentPayment', 'Premier paiement')} · {formatPrice(firstPayment)}
                            </span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex flex-col gap-1.5 p-3">
                          <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#e85d00] transition-colors">
                            {product.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-neutral-950">{formatPrice(product.price)}</span>
                            {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                              <span className="text-xs text-gray-400 line-through">{formatPrice(product.priceBeforeDiscount)}</span>
                            )}
                          </div>
                          {firstPayment > 0 && (
                            <div className="mt-0.5 flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-2">
                              <span className="text-[10px] font-black uppercase tracking-wide text-sky-700">
                                {t('home.startInstallmentWith', 'Commencez avec')}
                              </span>
                              <span className="text-sm font-black text-sky-950">{formatPrice(firstPayment)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              <Clock className="h-2.5 w-2.5" />
                              {duration > 0 ? `${duration} jours` : 'Tranches dispo.'}
                            </span>
                            {product.salesCount > 0 && (
                              <span className="text-[10px] text-gray-400">{product.salesCount} vendus</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            ) : (
              <p className="px-5 pb-5 text-sm text-gray-400">
                {t('home.noInstallmentProducts', 'Aucun produit en tranche disponible actuellement.')}
              </p>
            )}
          </section>
          )}
        </div>

        {/* Découvrir plus: quick-links to dedicated pages */}
        <section className="hidden lg:block">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-600">{t('home.discoverMore', 'Découvrir plus')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/cities"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <MapPin className="w-4 h-4" />
              Par ville
            </Link>
            <Link
              to="/top-favorites"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <Heart className="w-4 h-4" />
              Favoris
            </Link>
            <Link
              to="/top-ranking"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <Star className="w-4 h-4" />
              Mieux notés
            </Link>
            <Link
              to="/top-new"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Nouveautés
            </Link>
            <Link
              to="/top-used"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <Clock className="w-4 h-4" />
              Occasions
            </Link>
            <Link
              to="/certified-products"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-neutral-50 border border-gray-100 hover:border-neutral-200 text-gray-700 hover:text-neutral-700 font-medium text-sm transition-all"
            >
              <Shield className="w-4 h-4" />
              Produits certifiés
            </Link>
          </div>
        </section>

        {/* Zone 4: Inline Filters + Product Grid */}
        <section>
          {/* Inline filter bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Tous les produits
                <span className="text-sm font-normal text-gray-500 ml-2">({formatCount(totalProducts)})</span>
              </h2>
              {hasUserCity && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('home.nearYou', 'Produits près de vous')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={installmentOnlyFilter}
                  onChange={(e) => {
                    setInstallmentOnlyFilter(e.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-neutral-800 focus:ring-neutral-500"
                />
                Afficher uniquement les produits en tranche
              </label>
              {hasUserCity && (
                <label className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={nearMeOnlyFilter}
                    onChange={(e) => {
                      setNearMeOnlyFilter(e.target.checked);
                      setPage(1);
                    }}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-800 focus:ring-neutral-500"
                  />
                  {t('home.onlyMyCity', 'Voir uniquement dans ma ville')}
                </label>
              )}
              {/* Sort dropdown */}
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 cursor-pointer"
              >
                <option value="new">{t('home.sortNew', 'Nouveautés')}</option>
                <option value="price_asc">{t('home.sortPriceAsc', 'Prix croissant')}</option>
                <option value="price_desc">{t('home.sortPriceDesc', 'Prix décroissant')}</option>
                <option value="discount">{t('home.sortDiscount', 'Remises')}</option>
              </select>
              {/* Category filter */}
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 cursor-pointer"
              >
                <option value="">{t('home.allCategories', 'Toutes catégories')}</option>
                {allCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product grid - 4-5 columns */}
          {productsError ? (
            <NetworkFallbackCard
              title="Unable to load data."
              message={productsError}
              onRetry={loadProducts}
              retryLabel="Retry"
              refreshLabel="Refresh page"
            />
          ) : loading ? (
            <ShimmerSkeleton rows={4} />
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {items.map((product, index) => (
                  <div
                    key={`product-d-${product._id}-${index}`}
                    className="home-anim-fade-up hover:shadow-md transition-shadow rounded-xl overflow-hidden"
                    style={{ '--home-anim-delay': `${(index % 10) * 40}ms` }}
                  >
                    <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                  </div>
                ))}
              </div>
              {renderPagination()}
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.noProductsFound', 'Aucun produit trouvé')}</h3>
              <p className="text-gray-500 text-sm mb-4">{t('home.adjustFilters', 'Modifiez vos critères de filtrage')}</p>
              <button
                onClick={() => { setCategory(''); setSort('new'); setPage(1); }}
                className="apple-btn-primary px-4 py-2.5 text-sm"
              >
                {t('home.resetFilters', 'Réinitialiser les filtres')}
              </button>
            </div>
          )}
        </section>
      </main>
    );
  };

  return (
    <div className="hd-commerce-shell min-h-screen">
      {(offlineSnapshotActive || rapid3GActive) && (
        <div className="mx-auto max-w-7xl px-2 pt-3 sm:px-4 lg:px-8">
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        </div>
      )}
      {isMobileView ? renderMobileHome() : renderDesktopHome()}
      <FeaturedTagSections t={t} />

      {/* Category Modal (shared between mobile and desktop) */}
      <BaseModal
        isOpen={isCategoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        size="xl"
        mobileSheet
        ariaLabel={t('home.allCategories', 'Toutes les catégories')}
        panelClassName="sm:max-w-5xl hd-products-flow"
      >
        <ModalHeader
          title={t('home.exploreCategoriesTitle', 'Explorer nos univers')}
          subtitle={t('home.exploreCategoriesSubtitle', 'Sélectionnez une catégorie pour découvrir nos produits')}
          icon={<LayoutGrid className="w-4 h-4 text-[#e85d00]" />}
          onClose={() => setCategoryModalOpen(false)}
        />
        <ModalBody className="space-y-5">
          <div className="hd-products-hero rounded-2xl p-4 text-white sm:p-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 ring-1 ring-white/20">
              <LayoutGrid className="w-4 h-4 text-white" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {t('home.allCategories', 'Toutes les catégories')}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/86">
              Naviguez par univers comme un flux commerce: choisissez une famille puis affinez avec les sous-catégories.
            </p>
          </div>
          <Link
            to="/products"
            onClick={() => setCategoryModalOpen(false)}
            className="hd-primary-button inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black"
          >
            <LayoutGrid className="h-4 w-4" />
            Voir tout le catalogue
          </Link>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGroups.map((group) => {
              const Icon = group.icon;
              const firstOption = group.options?.[0]?.value || '';
              return (
                <article
                  key={group.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <Link
                    to={`/categories/${firstOption}`}
                    onClick={() => setCategoryModalOpen(false)}
                    className="group flex items-start gap-3"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-[#e85d00] ring-1 ring-gray-200 transition group-hover:scale-105">
                      {Icon ? <Icon className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-black text-gray-900">{group.label}</span>
                      <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-gray-500">{group.description}</span>
                    </span>
                  </Link>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.options.slice(0, 5).map((option) => (
                      <Link
                        key={option.value}
                        to={`/categories/${option.value}`}
                        onClick={() => setCategoryModalOpen(false)}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-500 transition hover:bg-orange-100"
                      >
                        {option.label}
                      </Link>
                    ))}
                    {group.options.length > 5 ? (
                      <Link
                        to={`/categories/${firstOption}`}
                        onClick={() => setCategoryModalOpen(false)}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 transition hover:border-gray-200 hover:text-[#e85d00]"
                      >
                        +{group.options.length - 5}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </ModalBody>
      </BaseModal>
    </div>
  );
}
