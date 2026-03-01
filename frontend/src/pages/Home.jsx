import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import MobileSplash from "../components/MobileSplash";
import categoryGroups from "../data/categories";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Search, Star, TrendingUp, Zap, Shield, Truck, Award, Heart, ChevronRight, Tag, Sparkles, RefreshCcw, MapPin, LayoutGrid, Clock, X, ShoppingBag, User, Flame } from "lucide-react";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import { buildProductPath, buildShopPath } from "../utils/links";
import AuthContext from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";

/**
 * 🎨 PAGE D'ACCUEIL HDMarket - Design Alibaba Mobile First
 * Focus sur les bonnes affaires avec prix visibles
 * Architecture optimisée pour e-commerce
 */

export default function Home() {
  const { user } = useContext(AuthContext);
  const { city: preferredCity, cities: configuredCities, formatPrice, t, language } = useAppSettings();
  // === ÉTATS PRINCIPAUX ===
  const [items, setItems] = useState([]);
  const [certifiedProducts, setCertifiedProducts] = useState([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("new");
  const [installmentOnlyFilter, setInstallmentOnlyFilter] = useState(false);
  const [nearMeOnlyFilter, setNearMeOnlyFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
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
  const [flashNow, setFlashNow] = useState(() => Date.now());
  const [heroBanner, setHeroBanner] = useState('');
  const [promoBanner, setPromoBanner] = useState('');
  const [promoBannerMobile, setPromoBannerMobile] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoNow, setPromoNow] = useState(() => new Date());
  const [appLogoMobile, setAppLogoMobile] = useState('');
  const [splashShown, setSplashShown] = useState(false);
  const [topProductsTab, setTopProductsTab] = useState('favorites');
  const [installmentProducts, setInstallmentProducts] = useState([]);
  const [installmentLoading, setInstallmentLoading] = useState(false);
  const [wholesaleProducts, setWholesaleProducts] = useState([]);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [shouldLoadInstallment, setShouldLoadInstallment] = useState(false);
  const installmentSectionRef = useRef(null);
const cityList = useMemo(
  () => (Array.isArray(configuredCities) ? configuredCities.map((item) => item.name).filter(Boolean) : []),
  [configuredCities]
);
const effectiveUserCity = preferredCity || user?.preferredCity || user?.city || '';
const externalLinkProps = useDesktopExternalLink();
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

  const isPromoActive = useMemo(() => {
    if (!promoBanner) return false;
    const startDate = parsePromoDate(promoBannerStartAt);
    const endDate = parsePromoDate(promoBannerEndAt);
    if (startDate && promoNow < startDate) return false;
    if (endDate && promoNow > endDate) return false;
    return true;
  }, [parsePromoDate, promoBanner, promoBannerEndAt, promoBannerStartAt, promoNow]);
  const showMobileSplash = isMobileView && !splashShown && loading && page === 1;

  // === CHARGEMENT DES PRODUITS ===
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const requestParams = { page, limit: 12, sort };
      if (category) requestParams.category = category;
      if (installmentOnlyFilter) requestParams.installmentOnly = true;
      if (hasUserCity) {
        requestParams.userCity = effectiveUserCity;
        requestParams.locationPriority = true;
      }
      if (nearMeOnlyFilter && hasUserCity) {
        requestParams.nearMe = true;
      }
      const { data } = await api.get("/products/public", { params: requestParams });
      const fetchedItems = Array.isArray(data) ? data : data.items || [];
      const pages = Array.isArray(data) ? 1 : data.pagination?.pages || 1;
      const total = Array.isArray(data)
        ? fetchedItems.length
        : Number(data?.pagination?.total) || fetchedItems.length;
      setItems((prev) => (isMobileView && page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      setTotalPages(pages);
      setTotalProducts(total);
    } catch (error) {
      console.error("Erreur chargement produits:", error);
    } finally {
      setLoading(false);
    }
  }, [page, sort, category, installmentOnlyFilter, hasUserCity, nearMeOnlyFilter, isMobileView, effectiveUserCity]);

  const loadInstallmentProducts = useCallback(async () => {
    setInstallmentLoading(true);
    try {
      const { data } = await api.get('/products/public/installments', {
        params: { page: 1, limit: 8 }
      });
      setInstallmentProducts(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error('Erreur chargement produits tranche:', error);
      setInstallmentProducts([]);
    } finally {
      setInstallmentLoading(false);
    }
  }, []);

  const loadWholesaleProducts = useCallback(async () => {
    setWholesaleLoading(true);
    try {
      const params = {
        page: 1,
        limit: isMobileView ? 8 : 10
      };
      if (hasUserCity && effectiveUserCity) {
        params.userCity = effectiveUserCity;
        params.nearMe = true;
      }
      const { data } = await api.get('/products/public/wholesale', { params });
      setWholesaleProducts(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error('Erreur chargement produits en gros:', error);
      setWholesaleProducts([]);
    } finally {
      setWholesaleLoading(false);
    }
  }, [effectiveUserCity, hasUserCity, isMobileView]);

  const loadCertifiedProducts = useCallback(async () => {
    try {
      const { data } = await api.get("/products/public", {
        params: {
          certified: true,
          sort: "new",
          limit: 8,
          page: 1
        }
      });
      const fetched = Array.isArray(data) ? data : data?.items || [];
      setCertifiedProducts(fetched.filter((product) => product?.certified));
    } catch (error) {
      console.error(
        "Erreur chargement produits certifiés:",
        error?.response?.status,
        error?.response?.data,
        error
      );
    }
  }, []);

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
    const loadAppLogo = async () => {
      try {
        const { data } = await api.get('/settings/app-logo');
        if (!active) return;
        setAppLogoMobile(data?.appLogoMobile || data?.appLogoDesktop || '');
      } catch (error) {
        if (!active) return;
        setAppLogoMobile('');
      }
    };
    loadAppLogo();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadPromoBanner = async () => {
      try {
        const { data } = await api.get('/settings/promo-banner');
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
    if (!loading && page === 1) {
      setSplashShown(true);
    }
  }, [loading, page]);

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
      const { data } = await api.get("/shops");
      const verifiedOnly = Array.isArray(data)
        ? data.filter((shop) => shop.shopVerified)
        : [];
      setVerifiedShops(verifiedOnly.slice(0, 6));
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
    try {
      const { data } = await api.get('/marketplace-promo-codes/public/home', {
        params: { shopLimit: 8, flashLimit: 8 }
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
  };

  // === CHARGEMENT DES PRODUITS EN PROMOTION ===
// === CHARGEMENT DES PRODUITS EN PROMOTION ===
const loadDiscountProducts = async () => {
  setDiscountLoading(true);
  try {
    const { data } = await api.get("/products/public", { 
      params: { 
        sort: 'discount',
        limit: 8,
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
    setDiscountProducts(shuffled.slice(0, 4));
  } catch (error) {
    console.error("Erreur chargement produits en promotion:", error);
  } finally {
    setDiscountLoading(false);
  }
};

  const renderPromoBanner = () => {
    if (!promoBanner) return null;
    const activeBanner = isMobileView && promoBannerMobile ? promoBannerMobile : promoBanner;
    const bannerSrc = isPromoActive ? activeBanner : defaultPromoBanner;
    const bannerLink = isPromoActive ? promoBannerLink : '/products';
    const bannerImage = (
      <img
        src={bannerSrc}
        alt="Bannière promotionnelle"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
    if (page >= totalPages) return;
    const handleScroll = () => {
      const threshold = 200;
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold
      ) {
        setPage((prev) => Math.min(prev + 1, totalPages));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileView, loading, page, totalPages]);

  useEffect(() => {
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
  }, [shouldLoadInstallment]);

  useEffect(() => {
    if (!shouldLoadInstallment) return;
    loadInstallmentProducts();
  }, [shouldLoadInstallment, loadInstallmentProducts]);

  const loadTopSales = async () => {
    setTopSalesLoading(true);
    try {
      const { data } = await api.get('/products/public/top-sales', {
        params: { limit: 6, page: 1 }
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTopSalesProducts(items);
    } catch (error) {
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
        params: { city: effectiveUserCity, limit: isMobileView ? 8 : 6, page: 1 }
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTopSalesCityTodayProducts(items);
    } catch (error) {
      console.error("Erreur chargement top ventes ville (aujourd'hui):", error);
      setTopSalesCityTodayProducts([]);
    } finally {
      setTopSalesCityTodayLoading(false);
    }
  }, [hasUserCity, isMobileView, effectiveUserCity]);

  useEffect(() => {
    loadHighlights();
    loadDiscountProducts();
    loadVerifiedShops();
    loadPromoHomeData();
    loadCertifiedProducts();
    loadTopSales();
  }, []);

  useEffect(() => {
    loadTopSalesTodayByCity();
  }, [loadTopSalesTodayByCity]);

  useEffect(() => {
    loadWholesaleProducts();
  }, [loadWholesaleProducts]);

  useEffect(() => {
    if (!flashDeals.length) return undefined;
    const timer = setInterval(() => {
      setFlashNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [flashDeals.length]);

  const cityHighlights = highlights.cityHighlights || {};

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

    const scrollStyle = { WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' };

    return (
      <main className="max-w-7xl mx-auto px-3 max-[375px]:px-2.5 pt-2.5 max-[375px]:pt-1.5 pb-4 max-[375px]:pb-3 space-y-3 max-[375px]:space-y-2.5">
        {/* Mobile Categories Module */}
        <section className="rounded-2xl border border-gray-200 bg-white p-3 max-[375px]:p-2.5 shadow-sm">
          <div className="mb-2.5 max-[375px]:mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 max-[375px]:gap-1.5">
              <div className="inline-flex h-6 w-6 max-[375px]:h-5 max-[375px]:w-5 items-center justify-center rounded-lg bg-neutral-900">
                <LayoutGrid className="h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3 text-white" />
              </div>
              <p className="text-xs max-[375px]:text-[11px] font-bold text-gray-900">{t('home.allCategories', 'Toutes catégories')}</p>
            </div>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 max-[375px]:px-2 py-1.5 max-[375px]:py-1 text-[11px] max-[375px]:text-[10px] font-semibold text-gray-700 transition-colors active:scale-95"
            >
              Tout voir <ChevronRight className="h-3 w-3 max-[375px]:h-2.5 max-[375px]:w-2.5" />
            </button>
          </div>
          <div className="flex gap-2 max-[375px]:gap-1.5 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
            <Link
              to="/products"
              {...externalLinkProps}
              className="inline-flex items-center gap-1.5 max-[375px]:gap-1 px-3.5 max-[375px]:px-3 py-2 max-[375px]:py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs max-[375px]:text-[11px] font-bold leading-none whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.08)] tap-feedback transition-transform"
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
                  className="inline-flex min-w-0 max-w-[138px] max-[375px]:max-w-[124px] items-center gap-1.5 max-[375px]:gap-1 px-3.5 max-[375px]:px-3 py-2 max-[375px]:py-1.5 rounded-full bg-white border border-gray-200 text-xs max-[375px]:text-[11px] font-semibold leading-none text-gray-700 whitespace-nowrap shadow-sm active:scale-95 transition-transform"
                  title={group.label}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 max-[375px]:w-3 max-[375px]:h-3 text-neutral-700 flex-shrink-0" />}
                  <span className="block min-w-0 truncate">{group.label.split(' & ')[0]}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Mobile Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-sm min-h-[170px] max-[375px]:min-h-[155px]">
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
                className="inline-flex items-center rounded-xl bg-white px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-gray-900"
              >
                Explorer <ChevronRight className="ml-1 h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3" />
              </Link>
              <Link
                to="/my"
                className="inline-flex items-center rounded-xl border border-white/35 bg-white/10 px-3 max-[375px]:px-2.5 py-2 max-[375px]:py-1.5 text-xs max-[375px]:text-[11px] font-semibold text-white backdrop-blur-sm"
              >
                <Zap className="mr-1 h-3.5 w-3.5 max-[375px]:h-3 max-[375px]:w-3" />
                Publier
              </Link>
            </div>
          </div>
        </section>

        {/* Buyer or Seller callout */}
        <div className="flex items-center justify-center gap-2 max-[375px]:gap-1.5 py-2.5 max-[375px]:py-2 px-3 max-[375px]:px-2.5 bg-neutral-50 rounded-xl border border-neutral-200/80">
          <ShoppingBag className="w-4 h-4 max-[375px]:w-3.5 max-[375px]:h-3.5 text-neutral-800 flex-shrink-0" />
          <span className="text-xs max-[375px]:text-[11px] text-gray-700 text-center">
            {t('home.buyOrSellPrefix', 'Achetez ou vendez sur HDMarket —')} <span className="font-semibold text-neutral-700">{t('home.youChoose', 'vous choisissez')}</span>.
          </span>
          <Tag className="w-4 h-4 max-[375px]:w-3.5 max-[375px]:h-3.5 text-neutral-800 flex-shrink-0" />
        </div>

        {/* Compact Promo Banner */}
        {promoBanner && (() => {
          const activeBanner = promoBannerMobile || promoBanner;
          const bannerSrc = isPromoActive ? activeBanner : defaultPromoBanner;
          const bannerLink = isPromoActive ? promoBannerLink : '/products';
          const img = <img src={bannerSrc} alt="Promo" className="h-full w-full object-cover" loading="eager" />;
          const cls = "block w-full overflow-hidden rounded-xl shadow-sm aspect-[2/1] h-[331px] max-[375px]:h-[280px]";
          if (bannerLink?.startsWith('/')) return <Link to={bannerLink} {...externalLinkProps} className={cls}>{img}</Link>;
          if (bannerLink) return <a href={bannerLink} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>;
          return <div className={cls}>{img}</div>;
        })()}

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
                    <img
                      src={product.images?.[0] || '/api/placeholder/400/400'}
                      alt={product.title}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
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

        {/* Boutiques en promo cette semaine */}
        {(!promoShopsLoading || promoShops.length > 0) && (
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
        {hasUserCity && (
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
                      <img
                        src={product.images?.[0] || '/api/placeholder/400/400'}
                        alt={product.title}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
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
                    <img
                      src={product.images?.[0] || '/api/placeholder/400/400'}
                      alt={product.title}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
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
          const firstCityWithData = cityList.find(c => (cityHighlights[c] || []).length > 0);
          // Prefer connected user's city when set (show their city even if no data yet)
          const displayCity =
            effectiveUserCity && (cityList.length === 0 || cityList.includes(effectiveUserCity))
              ? effectiveUserCity
              : firstCityWithData;
          const cityProds = displayCity ? (cityHighlights[displayCity] || []).slice(0, 8) : [];
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
                        <img
                          src={product.images?.[0] || '/api/placeholder/400/400'}
                          alt={product.title}
                          className="w-full h-full object-cover object-center"
                          loading="lazy"
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

        <section className="isolate rounded-2xl border border-emerald-100 bg-gradient-to-b from-white via-white to-emerald-50/60 p-3 max-[375px]:p-2.5 shadow-sm">
          <div className="mb-3 max-[375px]:mb-2.5 flex items-start justify-between gap-3 max-[375px]:gap-2">
            <div>
              <h2 className="text-sm max-[375px]:text-[13px] font-bold text-gray-900">{t('home.wholesaleTitle', 'Vente en gros')}</h2>
              <p className="mt-0.5 text-[11px] max-[375px]:text-[10px] text-neutral-600">
                {t('home.wholesaleSubtitle', 'Prix adaptés aux achats en quantité.')}
              </p>
            </div>
            <Link to="/products?wholesaleOnly=true" className="shrink-0 text-xs max-[375px]:text-[11px] font-semibold text-neutral-800">
              {t('home.viewAll', 'Voir tout')}
            </Link>
          </div>
          {wholesaleLoading && !wholesaleProducts.length ? (
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
                  <div key={`wholesale-mobile-${product._id}`} className="flex flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
                    <div className="min-h-0 flex-1">
                      <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                    </div>
                    <div className="mt-1 rounded-b-xl border-t border-neutral-100 bg-neutral-50 px-2 py-1.5 max-[375px]:px-1.5 max-[375px]:py-1">
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] max-[375px]:text-[9px] font-semibold text-neutral-700">
                        Vente en gros
                      </span>
                      <p className="mt-1 text-[11px] max-[375px]:text-[10px] leading-snug text-gray-600">
                        Commande minimum: <span className="font-semibold text-neutral-800">{minQty}</span> unités
                      </p>
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
        </section>

        <section ref={installmentSectionRef} className="isolate rounded-2xl border border-sky-100 bg-gradient-to-b from-white via-white to-sky-50/60 p-3 max-[375px]:p-2.5 shadow-sm">
          <div className="mb-3 max-[375px]:mb-2.5 flex items-start justify-between gap-3 max-[375px]:gap-2">
            <div>
              <h2 className="text-sm max-[375px]:text-[13px] font-bold text-gray-900">
                {t('home.installmentProducts', 'Produits disponibles en paiement par tranche')}
              </h2>
              <p className="mt-0.5 text-[11px] max-[375px]:text-[10px] text-neutral-600">
                {t('home.installmentSubtitle', 'Payez progressivement avec plus de flexibilité.')}
              </p>
            </div>
            <Link to="/products?installmentOnly=true" className="shrink-0 text-xs max-[375px]:text-[11px] font-semibold text-neutral-800">
              Voir tout
            </Link>
          </div>
          {installmentLoading && !installmentProducts.length ? (
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
                  <div key={`installment-mobile-${product._id}`} className="overflow-hidden rounded-xl border border-sky-100 bg-white p-1 max-[375px]:p-0.5 shadow-sm">
                    <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('home.noInstallmentProducts', 'Aucun produit en tranche disponible actuellement.')}</p>
          )}
        </section>

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

          {loading && page === 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-52" />
              ))}
            </div>
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
        {/* Category Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar items-center">
          <Link
            to="/products"
            {...externalLinkProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A0A0A] text-white text-sm font-bold whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-[#111111] transition-colors"
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-700 whitespace-nowrap shadow-sm hover:border-neutral-300 hover:text-neutral-800 transition-colors"
              >
                {Icon && <Icon className="w-4 h-4 text-neutral-700 flex-shrink-0" />}
                <span>{group.label.split(' & ')[0]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 text-sm font-semibold text-gray-600 whitespace-nowrap hover:bg-gray-200 transition-colors"
          >
            Tout voir <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Buyer or Seller callout */}
        <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gradient-to-r from-neutral-50 to-neutral-50 rounded-xl border border-neutral-200/80">
          <ShoppingBag className="w-5 h-5 text-neutral-800 flex-shrink-0" />
          <span className="text-sm text-gray-700 text-center">
            {t('home.buyOrSellPrefix', 'Achetez ou vendez sur HDMarket —')} <span className="font-semibold text-neutral-700">{t('home.youChoose', 'vous choisissez')}</span>.
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
                  Découvrez <span className="font-bold text-neutral-300">{formatCount(totalProducts)}</span> produits vérifiés. Vendez et achetez en toute confiance.
                </p>
                <div className="flex gap-3">
                  <Link to="/my" className="inline-flex items-center px-4 py-2.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-50 transition-all text-sm shadow-sm">
                    <Zap className="w-4 h-4 mr-1.5" /> Publier
                  </Link>
                  <Link to="/products" {...externalLinkProps} className="inline-flex items-center px-4 py-2.5 bg-white/15 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-sm">
                    Explorer <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            </section>

            {/* Promo Banner (below hero, full width of left column) */}
            {promoBanner && (() => {
              const bannerSrc = isPromoActive ? promoBanner : defaultPromoBanner;
              const bannerLink = isPromoActive ? promoBannerLink : '/products';
              const img = <img src={bannerSrc} alt="Promo" className="h-full w-full object-cover" loading="lazy" />;
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
                      <img
                        src={product.images?.[0] || '/api/placeholder/400/400'}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
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
        {hasUserCity && effectiveUserCity && (
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
                      <img
                        src={product.images?.[0] || '/api/placeholder/400/400'}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
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
                    <img
                      src={product.images?.[0] || '/api/placeholder/400/400'}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
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
                      <img
                        src={product.images?.[0] || '/api/placeholder/400/400'}
                        alt={product.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
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

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
          <section className="isolate rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/70 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">{t('home.wholesaleTitle', 'Vente en gros')}</h2>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {t('home.wholesaleSubtitle', 'Prix adaptés aux achats en quantité.')}
                </p>
              </div>
              <Link to="/products?wholesaleOnly=true" className="shrink-0 text-xs font-semibold text-neutral-800">
                {t('home.viewAll', 'Voir tout')}
              </Link>
            </div>
            {wholesaleLoading && !wholesaleProducts.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`wholesale-desktop-skeleton-${index}`} className="h-56 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : wholesaleProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {wholesaleProducts.slice(0, 4).map((product) => {
                  const minQty = Number(product?.wholesaleMinQty || product?.wholesaleTiers?.[0]?.minQty || 2);
                  return (
                    <div key={`wholesale-desktop-${product._id}`} className="flex flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
                      <div className="min-h-0 flex-1">
                        <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                      </div>
                      <div className="mt-0 rounded-b-xl border-t border-neutral-100 bg-neutral-50 px-2.5 py-2">
                        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                          Vente en gros
                        </span>
                        <p className="mt-1 text-xs text-gray-600">
                          Commande minimum: <span className="font-semibold text-neutral-800">{minQty}</span> unités
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t('home.noWholesaleProducts', 'Aucun produit en vente en gros actuellement.')}
              </p>
            )}
          </section>

          <section ref={installmentSectionRef} className="isolate rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/70 shadow-sm p-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {t('home.installmentProducts', 'Produits disponibles en paiement par tranche')}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {t('home.installmentSubtitle', 'Payez progressivement avec plus de flexibilité.')}
                </p>
              </div>
              <Link to="/products?installmentOnly=true" className="shrink-0 text-xs font-semibold text-neutral-800">
                Voir tout
              </Link>
            </div>
            {installmentLoading && !installmentProducts.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`installment-desktop-skeleton-${index}`} className="h-56 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (installmentProducts.length || highlights.installmentProducts?.length) > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(installmentProducts.length ? installmentProducts : highlights.installmentProducts)
                  .slice(0, 4)
                  .map((product) => (
                    <div key={`installment-desktop-${product._id}`} className="overflow-hidden rounded-xl border border-sky-100 bg-white p-1.5 shadow-sm">
                      <ProductCard p={product} productLink={buildHomeProductLink(product)} />
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t('home.noInstallmentProducts', 'Aucun produit en tranche disponible actuellement.')}
              </p>
            )}
          </section>
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
                <option value="electronics">{t('home.categoryElectronics', 'Électronique')}</option>
                <option value="fashion">{t('home.categoryFashion', 'Mode')}</option>
                <option value="home">{t('home.categoryHome', 'Maison')}</option>
                <option value="sports">{t('home.categorySports', 'Sports')}</option>
              </select>
            </div>
          </div>

          {/* Product grid - 4-5 columns */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-64" />
              ))}
            </div>
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <MobileSplash visible={showMobileSplash} logoSrc={appLogoMobile} label="HDMarket" />
      {isMobileView ? renderMobileHome() : renderDesktopHome()}

      {/* Category Modal (shared between mobile and desktop) */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setCategoryModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/50 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100/80 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-700/70 w-fit mb-2">
                    <LayoutGrid className="w-4 h-4 text-neutral-800 dark:text-neutral-500" />
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider">{t('home.allCategories', 'Toutes les catégories')}</span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">{t('home.exploreCategoriesTitle', 'Explorer nos univers')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('home.exploreCategoriesSubtitle', 'Sélectionnez une catégorie pour découvrir nos produits')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors text-gray-600 dark:text-gray-400"
                  aria-label={t('common.cancel', 'Fermer')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categoryGroups.map((group, index) => {
                  const Icon = group.icon;
                  const categoryStyles = [
                    { bg: 'from-[#0A0A0A]/10 to-[#6B7280]/10', icon: 'text-[#0A0A0A]', border: 'border-[#0A0A0A]/20', hover: 'hover:from-[#0A0A0A]/20 hover:to-[#6B7280]/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200/50 dark:border-neutral-800/50', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200/50 dark:border-neutral-800/50', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200/50 dark:border-neutral-800/50', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-800 dark:text-neutral-500', border: 'border-neutral-200/50 dark:border-neutral-700/70', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-800 dark:text-neutral-600', border: 'border-neutral-200/50 dark:border-neutral-700/70', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-neutral-500/10', icon: 'text-neutral-800 dark:text-neutral-500', border: 'border-neutral-200/50 dark:border-neutral-700/70', hover: 'hover:from-neutral-500/20 hover:to-neutral-500/20' },
                    { bg: 'from-neutral-500/10 to-gray-500/10', icon: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200/50 dark:border-neutral-800/50', hover: 'hover:from-neutral-500/20 hover:to-gray-500/20' }
                  ];
                  const style = categoryStyles[index % categoryStyles.length];
                  return (
                    <Link
                      key={group.id}
                      to={`/categories/${group.options?.[0]?.value || ''}`}
                      onClick={() => setCategoryModalOpen(false)}
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.bg} border ${style.border} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] ${style.hover}`}
                    >
                      <div className="p-4 flex flex-col items-center gap-3 text-center">
                        <div className={`relative w-16 h-16 rounded-2xl bg-white/80 dark:bg-gray-800/80 border-2 ${style.border} flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:rotate-3 group-hover:scale-110`}>
                          {Icon ? <Icon className={`relative w-8 h-8 ${style.icon}`} /> : null}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{group.label}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{group.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
