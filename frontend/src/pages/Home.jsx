import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { isApiCanceledError } from "../services/api";
import ProductCard from "../components/ProductCard";
import FlashSaleCard from "../components/FlashSaleCard";
import PreviewableImage from "../components/media/PreviewableImage";
import NetworkFallbackCard from "../components/ui/NetworkFallbackCard";
import ShimmerSkeleton from "../components/ui/ShimmerSkeleton";
import useCategories from '../hooks/useCategories';
import { Search, Star, TrendingUp, Zap, Shield, Truck, Award, Heart, ChevronRight, Tag, Sparkles, RefreshCcw, MapPin, LayoutGrid, Clock, X, ShoppingBag, User, Flame, Store, Wallet, Pencil, Users, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import { buildProductPath, buildShopPath } from "../utils/links";
import AuthContext from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import BaseModal, { ModalBody, ModalHeader } from "../components/modals/BaseModal";
import useNetworkProfile from "../hooks/useNetworkProfile";
import { loadOfflineSnapshot, saveOfflineSnapshot } from "../utils/offlineSnapshots";

const normalizeCityName = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';
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

// Eased count-up for the wallet balance reveal.
const useCountUp = (target, active, reduceMotion) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const to = Number(target) || 0;
    if (reduceMotion) {
      setValue(to);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, reduceMotion]);
  return value;
};

// The wallet section as an honest bank card: real balance (masked by default)
// for signed-in users, an activation pitch for guests. Module-level so its
// fetch/state survive Home re-renders.
const WALLET_BENEFIT_ROTATION_MS = 3500;

const WalletHomeCallout = ({ compact = false, user, t, walletEnabled }) => {
  const reduceMotion = useReducedMotion();
  const [balance, setBalance] = useState(null); // null = loading, number = ready
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [benefitIndex, setBenefitIndex] = useState(0);

  useEffect(() => {
    if (!user || !walletEnabled) return undefined;
    let cancelled = false;
    api
      .get('/wallet')
      .then(({ data }) => {
        if (!cancelled) setBalance(Number(data?.availableBalance || 0));
      })
      .catch(() => {
        if (!cancelled) setBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, walletEnabled]);

  const animatedBalance = useCountUp(balance ?? 0, balanceVisible && balance !== null, reduceMotion);

  const benefits = [
    {
      icon: Zap,
      label: t('home.walletFastTitle', 'Paiement plus rapide'),
      text: t('home.walletFastText', 'Validez vos achats en 1 clic, sans refaire un dépôt à chaque commande.')
    },
    {
      icon: Shield,
      label: t('home.walletProtectedTitle', 'Argent mieux suivi'),
      text: t('home.walletProtectedText', 'Chaque dépôt, achat et retrait reste visible dans votre historique.')
    },
    {
      icon: RefreshCcw,
      label: t('home.walletRefundTitle', 'Remboursement facilité'),
      text: t('home.walletRefundText', 'En cas d’annulation éligible, le remboursement revient sur votre solde.')
    },
    {
      icon: Sparkles,
      label: t('home.walletListingTitle', 'Annonces validées auto'),
      text: t('home.walletListingText', 'Payez les frais de publication depuis le solde, votre annonce part sans attente.')
    }
  ];

  // Auto-rotate the benefit spotlight; static list under reduced motion.
  useEffect(() => {
    if (reduceMotion || !walletEnabled) return undefined;
    const timer = setInterval(
      () => setBenefitIndex((prev) => (prev + 1) % benefits.length),
      WALLET_BENEFIT_ROTATION_MS
    );
    return () => clearInterval(timer);
  }, [reduceMotion, walletEnabled, benefits.length]);

  if (!walletEnabled) return null;

  const activeBenefit = benefits[benefitIndex % benefits.length];
  const ActiveBenefitIcon = activeBenefit.icon;

  return (
    <motion.section
      {...scrollReveal(reduceMotion)}
      className={`hd-wallet-callout relative w-full overflow-hidden rounded-2xl bg-[#06281f] text-white shadow-[0_14px_34px_rgba(6,40,31,0.18)] ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,106,0,0.16),transparent_30%),linear-gradient(135deg,rgba(6,40,31,0.96),rgba(11,80,58,0.9))]" />
      <div className="hd-wallet-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/18 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/90">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
            <span className="truncate">{t('home.walletBadge', 'Portefeuille HDMarket')}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-white/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-100 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {t('home.walletSecure', 'Sécurisé')}
          </span>
        </div>

        {user ? (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-100/70">
                {t('home.walletBalancePreview', 'Solde disponible')}
              </p>
              <button
                type="button"
                onClick={() => setBalanceVisible((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-emerald-100 transition active:scale-95"
                title={balanceVisible ? 'Masquer le solde' : 'Afficher le solde'}
              >
                {balanceVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className={`mt-1 font-black tracking-tight ${compact ? 'text-2xl' : 'text-3xl'}`}>
              {balance === null ? (
                <span className="inline-block h-7 w-32 animate-pulse rounded bg-white/15 align-middle" />
              ) : balanceVisible ? (
                formatPriceWithStoredSettings(animatedBalance)
              ) : (
                '••••••'
              )}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <h2 className={`font-black leading-tight tracking-tight ${compact ? 'text-lg' : 'text-xl'}`}>
              {t('home.walletTitle', 'Payez plus vite, gardez le contrôle de votre argent.')}
            </h2>
            <p className="mt-1.5 text-[12px] font-medium leading-5 text-emerald-50/80">
              {t('home.walletGuestPitch', 'Rechargez une fois, payez en 1 clic et recevez vos remboursements sur votre solde.')}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Link
            to={user ? '/wallet' : '/login'}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded bg-white px-3 py-2.5 text-[12px] font-black text-[#06281f] transition hover:bg-emerald-50 active:scale-[0.98] sm:flex-none sm:px-4 sm:text-[13px]"
          >
            <span className="truncate">
              {user ? t('home.walletOpen', 'Ouvrir mon portefeuille') : t('home.walletStart', 'Activer mon portefeuille')}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/60">
            {t('home.walletBenefitsTitle', 'Les bienfaits du portefeuille')}
          </p>
          {reduceMotion ? (
            <div className="mt-2.5 space-y-2">
              {benefits.map(({ icon: Icon, label, text }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-400/15 text-emerald-300">
                    <Icon className="h-3 w-3" />
                  </span>
                  <p className="text-[11px] leading-4 text-emerald-50/85">
                    <span className="font-black text-white">{label}</span>
                    {' — '}
                    {text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={`relative mt-2.5 overflow-hidden ${compact ? 'min-h-[58px]' : 'min-h-[52px]'}`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeBenefit.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                    className="flex items-start gap-2.5"
                  >
                    <motion.span
                      initial={{ scale: 0.6, rotate: -8 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.32, ease: 'easeOut' }}
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gradient-to-br from-emerald-400 to-emerald-200 text-[#06281f] shadow-[0_8px_18px_rgba(16,185,129,0.28)]"
                    >
                      <ActiveBenefitIcon className="h-3.5 w-3.5" />
                    </motion.span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black leading-4 text-white">{activeBenefit.label}</p>
                      <p className="mt-0.5 text-[11px] font-medium leading-4 text-emerald-50/80">{activeBenefit.text}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {benefits.map((benefit, index) => (
                  <button
                    key={benefit.label}
                    type="button"
                    onClick={() => setBenefitIndex(index)}
                    aria-label={benefit.label}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === benefitIndex % benefits.length
                        ? 'w-5 bg-emerald-300'
                        : 'w-1.5 bg-white/25 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.section>
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
    getRuntimeValue
  } = useAppSettings();
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
  const [promoBanner, setPromoBanner] = useState('');
  const [promoBannerMobile, setPromoBannerMobile] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoNow, setPromoNow] = useState(() => new Date());
  const [topProductsTab, setTopProductsTab] = useState('favorites');
  const [installmentProducts, setInstallmentProducts] = useState([]);
  const [installmentLoading, setInstallmentLoading] = useState(false);
  const [wholesaleProducts, setWholesaleProducts] = useState([]);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [homeFeedLoaded, setHomeFeedLoaded] = useState(false);
  const [shouldLoadSecondarySections, setShouldLoadSecondarySections] = useState(false);
  const [shouldLoadInstallment, setShouldLoadInstallment] = useState(false);
  const secondarySectionsRef = useRef(null);
  const installmentSectionRef = useRef(null);
  const infiniteScrollLockRef = useRef(0);
  const homeProductsAbortRef = useRef(null);
  const productsNextCursorRef = useRef('');
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
const walletFeatureEnabled = normalizeSettingBoolean(getRuntimeValue('enable_digital_wallet', false), false);
const reduceMotionHome = useReducedMotion();
const primaryPageLimit = compactProductsPageSize || 12;
const secondarySectionLimit = compactSecondaryLimit || 6;
const homeSnapshotKey = useMemo(
  () =>
    [
      'home',
      isMobileView ? 'mobile' : 'desktop',
      effectiveUserCity || 'all',
      category || 'all',
      sort || 'new',
      installmentOnlyFilter ? 'installment' : 'standard',
      nearMeOnlyFilter ? 'nearme' : 'all'
    ].join(':'),
  [
    category,
    effectiveUserCity,
    installmentOnlyFilter,
    isMobileView,
    nearMeOnlyFilter,
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
  const buildHomeProductLink = useCallback(
    (product) => {
      if (!product?.slug) return buildProductPath(product);
      return isMobileView ? `/product-preview/${product.slug}` : buildProductPath(product);
    },
    [isMobileView]
  );
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
      setItems((prev) => (isMobileView && page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      const nextCursor = String(data?.pagination?.nextCursor || data?.nextCursor || '');
      productsNextCursorRef.current = nextCursor;
      setTotalPages(nextCursor && isMobileView ? Math.max(page + 1, pages) : pages);
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
          setItems(Array.isArray(snapshot.items) ? snapshot.items : []);
          setTotalPages(Math.max(1, Number(snapshot.totalPages) || 1));
          setTotalProducts(Number(snapshot.totalProducts) || 0);
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
      } catch (error) {
        if (!active) return;
        setPromoBanner('');
        setPromoBannerMobile('');
        setPromoBannerLink('');
        setPromoBannerStartAt('');
        setPromoBannerEndAt('');
      }
    };
    loadPromoBanner();
    return () => {
      active = false;
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
      "group block w-full overflow-hidden rounded-[16px] border border-[#E5E5EA] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] aspect-[16/9] sm:aspect-[21/7] lg:aspect-[24/7] dark:bg-[#1C1C1E] dark:border-[#38383A]";
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

    setSearchParams(next, { replace: page === initialPageRef.current });
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

  useEffect(() => {
    if (!isMobileView) return;
    if (loading) return;
    if (loadMoreError) return;
    if (page >= totalPages) return;
    const handleScroll = () => {
      const now = Date.now();
      if (now - infiniteScrollLockRef.current < 400) return;
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        infiniteScrollLockRef.current = now;
        setPage((prev) => Math.min(prev + 1, totalPages));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  // === POUR VOUS — AI-Powered Recommendations ===
  const PourVousSection = () => {
    const { user } = useContext(AuthContext);
    const [recommendedProducts, setRecommendedProducts] = useState([]);
    const [recsLoading, setRecsLoading] = useState(true);
    const [recsError, setRecsError] = useState(false);
    const recsLoadedRef = useRef(false);

    useEffect(() => {
      if (!user || recsLoadedRef.current) return;
      recsLoadedRef.current = true;
      api.get('/products/recommendations', { params: { page: 1, limit: 8 }, skipCache: false })
        .then(({ data }) => {
          setRecommendedProducts(data?.items || []);
          setRecsLoading(false);
        })
        .catch(() => {
          setRecsError(true);
          setRecsLoading(false);
        });
    }, [user]);

    // Don't render anything while loading — avoid layout flash
    if (!user || recsLoading) return null;
    if (recommendedProducts.length === 0) return null;

    return (
      <section className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/40 to-orange-50/40 p-3 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">{t('home.pourVous', 'Pour vous')}</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {t('home.pourVousSubtitle', 'Recommandations basées sur vos goûts')}
            </p>
          </div>
          <Link to="/explore" className="shrink-0 text-xs font-semibold text-purple-700">
            {t('home.exploreAll', 'Explorer')} <Sparkles className="inline h-3 w-3 ml-0.5" />
          </Link>
        </div>

        {recsError ? (
          <p className="text-xs text-gray-500 py-3 text-center">
            {t('home.recsError', 'Indisponible. Revenez plus tard.')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recommendedProducts.slice(0, 4).map((product) => (
              <div key={`pourvous-${product._id}`} className="overflow-hidden rounded-xl border border-purple-100 bg-white p-1 shadow-sm hover:shadow-md transition">
                <ProductCard p={product} productLink={buildHomeProductLink(product)} />
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // === MOBILE COMPACT FEED LAYOUT (Proposal A) ===
  const renderMobileHome = () => {
    const fallbackDeals = [
      ...highlights.topDeals.slice(0, 4),
      ...discountProducts.filter(p => !highlights.topDeals.some(d => d._id === p._id)).slice(0, 4)
    ].slice(0, 8);
    const displayFlashDeals = (flashDeals.length ? flashDeals : fallbackDeals).slice(0, 8);
    const heroProducts = [
      ...displayFlashDeals,
      ...topSalesProducts,
      ...items
    ].filter(Boolean).slice(0, 4);
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

    const scrollStyle = { WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' };

    return (
      <main className="max-w-7xl mx-auto px-2.5 max-[375px]:px-2 pt-3 max-[375px]:pt-2.5 pb-4 max-[375px]:pb-3 space-y-3 max-[375px]:space-y-2.5">
        {/* Pour Vous — AI Recommendations (placed prominently at top) */}
        <PourVousSection />

        {(user || showFullPaymentHomeBanner) ? (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            {user ? (
              <Link
                to="/profile"
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:scale-[0.99] ${
                  hasDeliveryAddress ? '' : 'bg-amber-50/60'
                }`}
              >
                <span
                  className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                    hasDeliveryAddress
                      ? 'bg-[#fff2e6] text-[#ff6a00] ring-orange-100'
                      : 'bg-amber-100 text-amber-700 ring-amber-200'
                  }`}
                >
                  <MapPin className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                      {t('home.deliveryAddress', 'Adresse de livraison')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                        hasDeliveryAddress ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${hasDeliveryAddress ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {hasDeliveryAddress ? 'Prête' : 'À compléter'}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[15px] font-black leading-tight text-slate-950">
                    {connectedUserDeliveryAddressLabel}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-[11px] font-black text-gray-700">
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden min-[400px]:inline">Modifier</span>
                </span>
              </Link>
            ) : null}
            {showFullPaymentHomeBanner ? (
              <Link
                to="/products"
                {...externalLinkProps}
                className={`group block bg-gradient-to-r from-emerald-50 via-white to-orange-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99] ${
                  user ? 'border-t border-gray-200' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.18)]">
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
                className="group block border-t border-gray-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-4 py-3.5 transition-all duration-200 active:scale-[0.99] dark:border-neutral-800 dark:from-amber-950/40 dark:via-neutral-950 dark:to-orange-950/30"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF6A00] text-white shadow-[0_10px_20px_rgba(255,106,0,0.18)]">
                    <Users className="h-[22px] w-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#FF6A00] ring-1 ring-orange-100">
                      <Sparkles className="h-3 w-3" />
                      Paiement par un proche
                    </span>
                    <span className="mt-1 block line-clamp-2 text-[13px] font-black leading-5 text-slate-950">
                      {payForOtherBannerText}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF6A00] px-3 py-2 text-[11px] font-black text-white shadow-sm">
                    Voir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : null}
          </section>
        ) : null}

        <WalletHomeCallout compact user={user} t={t} walletEnabled={walletFeatureEnabled} />

        <section className="-mx-2.5 overflow-hidden rounded-b-[30px] bg-[#ff3d13] text-white shadow-[0_16px_34px_rgba(255,106,0,0.2)] max-[375px]:-mx-2">
          <div className="relative px-4 pb-4 pt-4 max-[375px]:px-3">
            <div className="pointer-events-none absolute -right-8 top-3 h-24 w-24 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute left-32 -top-8 h-16 w-16 rounded-full bg-amber-200/20 blur-xl" />
            <div className="relative flex items-center justify-between gap-3">
              <Link to="/" className="flex items-center gap-2" {...externalLinkProps}>
                <span className="text-[30px] font-black leading-none tracking-tight">HDMarket</span>
              </Link>
              <Link
                to="/cities"
                {...externalLinkProps}
                className="inline-flex min-w-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-xs font-semibold backdrop-blur"
              >
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="max-w-[86px] truncate">{effectiveUserCity || 'Local'}</span>
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
              </Link>
            </div>

            <div className="relative mt-4 flex gap-6 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {discoveryTabs.map((tab, index) => (
                <Link
                  key={tab.label}
                  to={tab.to}
                  {...externalLinkProps}
                  className={`relative flex-shrink-0 text-base font-extrabold ${index === 0 ? 'text-white' : 'text-white/76'}`}
                >
                  {tab.label}
                  {index === 0 ? <span className="absolute -bottom-2 left-1 h-1 w-7 rounded-full bg-white" /> : null}
                </Link>
              ))}
            </div>

            <div className="relative mt-4 flex h-[54px] items-center gap-2 rounded-full border-2 border-white bg-white px-3 shadow-[0_10px_26px_rgba(123,42,0,0.18)]">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#ff4f17] active:scale-95"
                aria-label="Ouvrir les catégories"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <Link
                to="/products"
                {...externalLinkProps}
                className="min-w-0 flex-1 truncate text-left text-[15px] font-semibold text-slate-700"
              >
                Rechercher produits, boutiques, ville...
              </Link>
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-full bg-[#ff5a1f] text-white shadow-[0_8px_18px_rgba(255,90,31,0.28)] active:scale-95"
                aria-label="Rechercher"
              >
                <Search className="h-6 w-6" />
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
          <div className="grid grid-cols-5 gap-2">
            {shortcutItems.map(({ label, icon: Icon, to }, index) => (
              <Link
                key={label}
                to={to}
                {...externalLinkProps}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center active:scale-95"
              >
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                  index === 0 ? 'bg-amber-100 text-amber-700' :
                  index === 1 ? 'bg-orange-100 text-[#ff5a1f]' :
                  index === 2 ? 'bg-rose-100 text-rose-600' :
                  index === 3 ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate text-[11px] font-bold text-slate-800">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {heroProducts.length > 0 ? (
          <section className="overflow-hidden rounded-2xl bg-[#ff3d13] p-2 shadow-[0_12px_30px_rgba(255,69,20,0.22)]">
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/top-deals"
                {...externalLinkProps}
                className="col-span-2 flex min-h-[118px] overflow-hidden rounded-xl bg-white/95 text-slate-950 active:scale-[0.99]"
              >
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-wide text-[#ff4f17]">Sélection chaude</p>
                    <p className="mt-1 text-xl font-black leading-tight">Offres à suivre aujourd’hui</p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#ff5a1f] px-3 py-1.5 text-xs font-black text-white">
                    Voir <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="grid w-[42%] grid-cols-2 gap-1 p-2">
                  {heroProducts.slice(0, 4).map((product, idx) => (
                    <div key={`hero-thumb-${product._id || idx}`} className="overflow-hidden rounded-xl bg-gray-100">
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
              {heroProducts.slice(0, 2).map((product, idx) => (
                <Link
                  key={`hero-product-${product._id || idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="overflow-hidden rounded-xl bg-white/95 active:scale-[0.98]"
                >
                  <div className="aspect-[1.18/1] overflow-hidden bg-gray-100">
                    <PreviewableImage
                      product={product}
                      src={resolveProductPrimaryImage(product)}
                      images={resolveProductImageSet(product)}
                      alt={product.title || 'Produit'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      reportContext={buildImageReportContext(product, buildHomeProductLink(product))}
                      showHint={false}
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-1 text-[12px] font-black text-slate-900">{product.title}</p>
                    <p className="mt-1 text-[17px] font-black leading-none text-[#ff4f17]">
                      {Number(product.promoPrice ?? product.price ?? 0).toLocaleString()} F
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* Mobile Categories Module */}
        <section className="hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_14px_34px_rgba(117,75,36,0.08)] max-[375px]:p-2.5">
          <div className="mb-2.5 max-[375px]:mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 max-[375px]:gap-1.5">
              <div className="inline-flex h-7 w-7 max-[375px]:h-6 max-[375px]:w-6 items-center justify-center rounded-xl bg-[#FF6A00] shadow-sm">
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
              className="inline-flex items-center gap-1.5 max-[375px]:gap-1 px-3.5 max-[375px]:px-3 py-2 max-[375px]:py-1.5 rounded-full bg-[#FF6A00] text-white text-xs max-[375px]:text-[11px] font-black leading-none whitespace-nowrap shadow-[0_8px_18px_rgba(255,106,0,0.22)] tap-feedback transition-transform"
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
                    <span className="inline-flex h-5 w-5 max-[375px]:h-[18px] max-[375px]:w-[18px] items-center justify-center rounded-full bg-gray-100 text-[#FF6A00] flex-shrink-0 mx-auto">
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
                className="inline-flex items-center rounded-xl bg-white px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-neutral-950 shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98]"
              >
                Explorer <ChevronRight className="ml-1 h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3" />
              </Link>
              {sellingEnabled && (
                <Link
                  to="/my"
                  className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)] backdrop-blur transition-all duration-200 hover:bg-white/15 active:scale-[0.98]"
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
          const cls = "block w-full overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm aspect-[16/9] max-h-[220px] max-[375px]:max-h-[190px]";
          if (bannerLink?.startsWith('/')) return <Link to={bannerLink} {...externalLinkProps} className={cls}>{img}</Link>;
          if (bannerLink) return <a href={bannerLink} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>;
          return <div className={cls}>{img}</div>;
        })()}

        <div ref={secondarySectionsRef} className="h-px" aria-hidden="true" />

        {/* Flash Deals Horizontal Strip */}
        {!(highlightLoading && flashDealsLoading) && displayFlashDeals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-900 rounded-lg flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('home.flashDeals', 'Flash Deals')}</h2>
              </div>
              <Link to="/top-deals" {...externalLinkProps} className="text-xs font-semibold text-neutral-800 flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {displayFlashDeals.map((product, idx) => (
                <Link
                  key={`flash-${product._id}-${idx}`}
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
                    {product.flashPromo?.endDate && (
                      <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        {formatCountdown(product.flashPromo.endDate, flashNow)}
                      </span>
                    )}
                    {product.discount > 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-neutral-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                        -{product.discount}%
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex flex-col min-h-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {Number(product.promoPrice ?? product.price ?? 0).toLocaleString()} F
                    </p>
                    {product.priceBeforeDiscount > product.price && (
                      <p className="text-[10px] text-gray-400 line-through">
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
          <motion.section {...scrollReveal(reduceMotionHome)} className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/40 to-orange-50/40 p-3">
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
          <section>
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
          <section>
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
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('home.bestSales', 'Meilleures ventes')}</h2>
              </div>
              <Link to="/top-sales" {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {topSalesProducts.slice(0, 6).map((product, idx) => (
                <Link
                  key={`bestseller-${product._id}-${idx}`}
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
                    {idx < 3 && (
                      <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ${
                        idx === 0 ? 'bg-neutral-500' : idx === 1 ? 'bg-gray-400' : 'bg-neutral-600'
                      }`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex flex-col min-h-0">
                    <p className="text-[11px] text-gray-700 font-medium truncate">{product.title}</p>
                    <p className="text-xs font-bold text-gray-900">{Number(product.price || 0).toLocaleString()} F</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Verified Shops Strip */}
        {!verifiedLoading && verifiedShops.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">{t('home.verifiedShops', 'Boutiques vérifiées')}</h2>
              </div>
              <Link to="/shops/verified" {...externalLinkProps} className="text-xs font-semibold text-[#0A0A0A] flex items-center">
                {t('home.viewAll', 'Voir tout')} <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {verifiedShops.map((shop) => (
                <Link
                  key={shop._id}
                  to={buildShopPath(shop)}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <div className="relative w-10 h-10 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100 border border-gray-100">
                    <img
                      src={shop.shopLogo || '/api/placeholder/40/40'}
                      alt={shop.shopName}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{shop.shopName}</p>
                    <p className="text-[10px] text-neutral-600 font-medium">{shop.productCount || 0} {t('home.listings', 'annonces')}</p>
                  </div>
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
            <section>
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
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
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

        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
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
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
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
        <motion.section {...scrollReveal(reduceMotionHome)} className="isolate overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" style={{ minHeight: shouldLoadSecondarySections ? undefined : 320 }}>
          <div className="px-3 pb-3 pt-3 max-[375px]:px-2.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                  <ShoppingBag className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-sm font-black tracking-tight text-gray-900">{t('home.wholesaleTitle', 'Vente en gros')}</h2>
                    <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-700">B2B</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-gray-500 max-[375px]:text-[10px]">
                {t('home.wholesaleSubtitle', 'Prix adaptés aux achats en quantité.')}
              </p>
                </div>
            </div>
              <Link to="/products?wholesaleOnly=true" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 active:scale-95">
              {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {!shouldLoadSecondarySections ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`ws-reserve-${i}`} className="aspect-[3/4] max-h-48 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : wholesaleLoading && !wholesaleProducts.length ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`wholesale-skeleton-${index}`} className="aspect-[3/4] max-h-48 animate-pulse rounded-xl bg-gray-200 overflow-hidden" />
              ))}
            </div>
          ) : wholesaleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {wholesaleProducts.slice(0, 4).map((product) => {
                const minQty = Number(product?.wholesaleMinQty || product?.wholesaleTiers?.[0]?.minQty || 2);
                return (
                  <div key={`wholesale-mobile-${product._id}`} className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white">
                    <div className="min-h-0 flex-1">
                      <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                    </div>
                    <div className="flex items-center justify-between gap-1.5 border-t border-gray-100 px-2 py-1.5 max-[375px]:px-1.5">
                      <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold text-emerald-700">
                        <Tag className="h-3 w-3 shrink-0" />
                        <span className="truncate">Prix de gros</span>
                      </span>
                      <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">x{minQty}+</span>
                    </div>
                  </div>
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
        <motion.section {...scrollReveal(reduceMotionHome)} ref={installmentSectionRef} className="isolate overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" style={{ minHeight: shouldLoadSecondarySections ? undefined : 320 }}>
          <div className="px-3 pb-3 pt-3 max-[375px]:px-2.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-600 text-white">
                  <Wallet className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="line-clamp-1 text-sm font-black tracking-tight text-gray-900">
                {t('home.installmentProducts', 'Paiement par tranche')}
              </h2>
                    <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-sky-700">Flex</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-gray-500 max-[375px]:text-[10px]">
                {t('home.installmentSubtitle', 'Payez progressivement avec plus de flexibilité.')}
              </p>
                </div>
            </div>
              <Link to="/products?installmentOnly=true" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-black text-sky-700 active:scale-95">
              {t('home.viewAll', 'Voir tout')}
                <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {!shouldLoadSecondarySections ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`is-reserve-${i}`} className="aspect-[3/4] max-h-48 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : installmentLoading && !installmentProducts.length ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`installment-skeleton-${index}`} className="h-48 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : (installmentProducts.length || highlights.installmentProducts?.length) > 0 ? (
            <div className="grid grid-cols-2 gap-3 max-[375px]:grid-cols-1 max-[375px]:gap-2.5">
              {(installmentProducts.length ? installmentProducts : highlights.installmentProducts)
                .slice(0, 4)
                .map((product) => (
                  <div key={`installment-mobile-${product._id}`} className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white">
                    <div className="min-h-0 flex-1">
                      <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                    </div>
                    <div className="flex items-center justify-between gap-1.5 border-t border-gray-100 px-2 py-1.5 max-[375px]:px-1.5">
                      <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-bold text-sky-700">
                        <Wallet className="h-3 w-3 shrink-0" />
                        <span className="truncate">Dès {formatPrice(product?.installmentMinAmount || product?.price || 0)}</span>
                      </span>
                      {product?.installmentDuration ? (
                        <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-black text-sky-700">{product.installmentDuration}j</span>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('home.noInstallmentProducts', 'Aucun produit en tranche disponible actuellement.')}</p>
          )}
          </div>
        </motion.section>

        {/* All Products Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-neutral-500 to-neutral-600 flex items-center justify-center shadow-md shadow-black/20">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('home.forYou', 'Pour vous')}</h2>
                <p className="text-xs text-gray-500 font-medium">
                  <span className="tabular-nums font-semibold text-neutral-800">{formatCount(totalProducts)}</span> {t('home.listings', 'annonces')}
                </p>
                {hasUserCity && (
                  <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                    <MapPin className="h-3 w-3" />
                    {t('home.nearYou', 'Produits près de vous')}
                  </p>
                )}
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
              <div className="grid grid-cols-2 gap-2">
                {items.map((product, index) => (
                  <div key={`product-${product._id}-${index}`} className="w-full h-full">
                    <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                  </div>
                ))}
              </div>
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
        <section className="pb-2">
          <h3 className="text-sm font-bold text-gray-900 mb-2.5">{t('home.discoverMore', 'Découvrir plus')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/top-favorites"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-neutral-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.topFavorites', 'Top Favoris')}</span>
            </Link>
            <Link
              to="/top-ranking"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-neutral-600" fill="currentColor" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.topRated', 'Top Notés')}</span>
            </Link>
            <Link
              to="/top-new"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-neutral-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.newProducts', 'Neufs')}</span>
            </Link>
            <Link
              to="/top-used"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <RefreshCcw className="w-4 h-4 text-neutral-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.usedProducts', 'Occasion')}</span>
            </Link>
            <Link
              to="/certified-products"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-neutral-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.certified', 'Certifiés')}</span>
            </Link>
            <Link
              to="/cities"
              {...externalLinkProps}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-neutral-800" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">{t('home.cities', 'Villes')}</span>
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

    return (
      <main className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-6 lg:px-8 py-4 space-y-5">
        {(user || showFullPaymentHomeBanner) ? (
          <section className={`grid gap-3 ${user && showFullPaymentHomeBanner ? 'lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]' : 'grid-cols-1'}`}>
            {user ? (
              <Link
                to="/profile"
                className="group flex min-w-0 items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-[0_14px_34px_rgba(117,75,36,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fff2e6] text-[#ff6a00] ring-1 ring-gray-200">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                      {t('home.deliveryAddress', 'Adresse de livraison')}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      hasDeliveryAddress ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {hasDeliveryAddress ? 'Adresse prête' : 'À compléter'}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-base font-black text-slate-950">
                    {connectedUserDeliveryAddressLabel}
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                    Utilisée pour calculer la livraison au checkout
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-500 ring-1 ring-gray-200 transition group-hover:bg-[#ff6a00] group-hover:text-white">
                  Modifier <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ) : null}
            {showFullPaymentHomeBanner ? (
              <Link
                to="/products"
                {...externalLinkProps}
                className="group flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-orange-50 px-4 py-3 shadow-[0_14px_34px_rgba(16,185,129,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200"
              >
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)]">
                  <Truck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Livraison offerte
                  </span>
                  <span className="mt-1.5 block line-clamp-2 text-sm font-black leading-5 text-slate-950">
                    {fullPaymentBannerText}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-black text-white shadow-sm transition group-hover:bg-[#ff6a00]">
                  En savoir plus
                </span>
              </Link>
            ) : null}
          </section>
        ) : null}
        <WalletHomeCallout user={user} t={t} walletEnabled={walletFeatureEnabled} />
        {/* Category Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar items-center">
          <Link
            to="/products"
            {...externalLinkProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF6A00] text-white text-sm font-black whitespace-nowrap shadow-[0_10px_22px_rgba(255,106,0,0.22)] hover:bg-[#e85f00] transition-colors"
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
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[#FF6A00] flex-shrink-0 mx-auto">
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
            <section className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl overflow-hidden shadow-lg" style={{ minHeight: '300px' }}>
              {heroBanner && (
                <div className="absolute inset-0">
                  <img src={heroBanner} alt="Bannière HDMarket" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/70 via-neutral-950/70 to-neutral-950/70" />
                </div>
              )}
              <div className="relative z-10 px-6 py-8 lg:py-10 text-left">
                <div className="inline-flex items-center px-3 py-1.5 bg-white/15 backdrop-blur-md rounded-full border border-white/30 mb-4 shadow-lg">
                  <Star className="w-3.5 h-3.5 text-neutral-300 mr-1.5" fill="currentColor" />
                  <span className="text-xs text-white font-semibold">{t('nav.marketplacePremium', 'Marketplace Premium')}</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-white mb-3 leading-tight">
                  Votre Marché
                  <span className="block bg-gradient-to-r from-neutral-300 via-neutral-400 to-neutral-300 bg-clip-text text-transparent">{t('home.digital', 'Digital')}</span>
                </h1>
                <p className="text-sm text-neutral-200 mb-5 max-w-md leading-relaxed">
                  {desktopHeroDescription}
                </p>
                <div className="flex gap-3">
                  {sellingEnabled && (
                    <Link to="/my" className="inline-flex items-center px-4 py-2.5 border border-white/25 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/15 transition-all text-sm shadow-[0_10px_24px_rgba(0,0,0,0.16)] backdrop-blur active:scale-[0.99]">
                      <Zap className="w-4 h-4 mr-1.5" /> Publier
                    </Link>
                  )}
                  <Link to="/products" {...externalLinkProps} className="inline-flex items-center px-4 py-2.5 bg-white text-neutral-950 font-semibold rounded-xl hover:bg-neutral-100 transition-all text-sm shadow-[0_10px_24px_rgba(0,0,0,0.18)] active:scale-[0.99]">
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
                <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
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
                      {product.flashPromo?.endDate && (
                        <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          {formatCountdown(product.flashPromo.endDate, flashNow)}
                        </span>
                      )}
                      {product.discount > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-neutral-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">-{product.discount}%</span>
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

        {/* Zone 2: Best Sellers Row (5 columns) */}
        {!topSalesLoading && topSalesProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-neutral-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{t('home.bestSales', 'Meilleures ventes')}</h2>
              </div>
              <Link to="/top-sales" {...externalLinkProps} className="text-sm font-semibold text-[#0A0A0A] flex items-center hover:text-[#111111]">
                Voir tout <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
              {topSalesProducts.slice(0, 5).map((product, idx) => (
                <Link
                  key={`bestseller-d-${product._id}-${idx}`}
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
                    {idx < 3 && (
                      <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg ${
                        idx === 0 ? 'bg-neutral-500' : idx === 1 ? 'bg-gray-400' : 'bg-neutral-600'
                      }`}>
                        {idx + 1}
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

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
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
              <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4 2xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
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
              <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4 2xl:grid-cols-2">
                {wholesaleProducts.slice(0, 4).map((product, idx) => {
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
                        {/* Tier price badge */}
                        {tierPrice && tierPrice !== product.price && (
                          <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                            Dès {formatPrice(tierPrice)}/u
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex flex-col gap-1.5 p-3">
                        <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#FF6A00] transition-colors">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-[#FF6A00]">{formatPrice(product.price)}</span>
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
                  <Wallet className="h-5 w-5" />
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

            {installmentLoading && !installmentProducts.length ? (
              <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4 2xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
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
            ) : (installmentProducts.length || highlights.installmentProducts?.length) > 0 ? (
              <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4 2xl:grid-cols-2">
                {(installmentProducts.length ? installmentProducts : highlights.installmentProducts)
                  .slice(0, 4)
                  .map((product, idx) => {
                    const duration = product?.installmentDuration || 0;
                    const minAmount = product?.installmentMinAmount || 0;
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
                          {minAmount > 0 && (
                            <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-black/75 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white">
                              Dès {formatPrice(minAmount)}
                            </span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex flex-col gap-1.5 p-3">
                          <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#FF6A00] transition-colors">
                            {product.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-[#FF6A00]">{formatPrice(product.price)}</span>
                            {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                              <span className="text-xs text-gray-400 line-through">{formatPrice(product.priceBeforeDiscount)}</span>
                            )}
                          </div>
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
                  <div key={`product-d-${product._id}-${index}`} className="hover:shadow-md transition-shadow rounded-xl overflow-hidden">
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
          icon={<LayoutGrid className="w-4 h-4 text-[#FF6A00]" />}
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
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_14px_34px_rgba(117,75,36,0.08)]"
                >
                  <Link
                    to={`/categories/${firstOption}`}
                    onClick={() => setCategoryModalOpen(false)}
                    className="group flex items-start gap-3"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-[#FF6A00] ring-1 ring-gray-200 transition group-hover:scale-105">
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
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-600 transition hover:border-gray-200 hover:text-[#FF6A00]"
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
