import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Search, Star, TrendingUp, Zap, Shield, Truck, Award, Heart, ChevronRight, Tag, Sparkles, RefreshCcw, MapPin, LayoutGrid, Clock, X, ShoppingBag } from "lucide-react";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import { buildProductPath, buildShopPath } from "../utils/links";

/**
 * 🎨 PAGE D'ACCUEIL HDMarket - Design Alibaba Mobile First
 * Focus sur les bonnes affaires avec prix visibles
 * Architecture optimisée pour e-commerce
 */

export default function Home() {
  // === ÉTATS PRINCIPAUX ===
  const [items, setItems] = useState([]);
  const [certifiedProducts, setCertifiedProducts] = useState([]);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("new");
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
    cityHighlights: {}
  });
  const [highlightLoading, setHighlightLoading] = useState(false);
  const [discountProducts, setDiscountProducts] = useState([]);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [topSalesProducts, setTopSalesProducts] = useState([]);
  const [topSalesLoading, setTopSalesLoading] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [verifiedShops, setVerifiedShops] = useState([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [heroBanner, setHeroBanner] = useState('');
  const [promoBanner, setPromoBanner] = useState('');
  const [promoBannerMobile, setPromoBannerMobile] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoNow, setPromoNow] = useState(() => new Date());
  const [appLogoMobile, setAppLogoMobile] = useState('');
  const [splashShown, setSplashShown] = useState(false);
const cityList = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
const externalLinkProps = useDesktopExternalLink();
const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const formatCount = (value) =>
  Number(value || 0).toLocaleString('fr-FR');
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

  // === PARAMÈTRES DE RECHERCHE ===
  const params = useMemo(() => {
    const p = { page, limit: 12, sort };
    if (category) p.category = category;
    return p;
  }, [category, page, sort]);

  // === CHARGEMENT DES PRODUITS ===
const loadProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products/public", { params });
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
  };

  const loadCertifiedProducts = useCallback(async () => {
    try {
      console.debug('loading certified products', {
        params: { certified: true, sort: 'recent', limit: 8, page: 1 }
      });
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
      "group block w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm aspect-[16/9] sm:aspect-[21/7] lg:aspect-[24/7]";
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
    setPage(1);
  }, [sort, category]);

  useEffect(() => {
    loadProducts();
  }, [page, sort, category, isMobileView]);

  useEffect(() => {
    if (page === initialPageRef.current) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (page === 1) {
          params.delete('page');
        } else {
          params.set('page', String(page));
        }
        return params;
      }, { replace: true });
    } else {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (page === 1) {
          params.delete('page');
        } else {
          params.set('page', String(page));
        }
        return params;
      }, { replace: false });
    }
  }, [page, setSearchParams]);

  useEffect(() => {
    initialPageRef.current = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage(initialPageRef.current);
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

  useEffect(() => {
    loadHighlights();
    loadDiscountProducts();
    loadVerifiedShops();
    loadCertifiedProducts();
    loadTopSales();
  }, []);

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
                  ? "bg-indigo-600 text-white border-indigo-600"
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
    const allDeals = [
      ...highlights.topDeals.slice(0, 4),
      ...discountProducts.filter(p => !highlights.topDeals.some(d => d._id === p._id)).slice(0, 4)
    ].slice(0, 8);

    const scrollStyle = { WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' };

    return (
      <main className="max-w-7xl mx-auto px-3 pt-2 pb-4 space-y-3">
        {/* Horizontal Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" style={scrollStyle}>
          <Link
            to="/products"
            {...externalLinkProps}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold whitespace-nowrap shadow-sm active:scale-95 transition-transform"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Tout
          </Link>
          {categoryGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.id}
                to={`/categories/${group.options?.[0]?.value || ''}`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700 whitespace-nowrap shadow-sm active:scale-95 transition-transform"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
                <span>{group.label.split(' & ')[0]}</span>
              </Link>
            );
          })}
        </div>

        {/* Compact Promo Banner */}
        {promoBanner && (() => {
          const activeBanner = promoBannerMobile || promoBanner;
          const bannerSrc = isPromoActive ? activeBanner : defaultPromoBanner;
          const bannerLink = isPromoActive ? promoBannerLink : '/products';
          const img = <img src={bannerSrc} alt="Promo" className="h-full w-full object-cover" loading="eager" />;
          const cls = "block w-full overflow-hidden rounded-xl shadow-sm aspect-[2/1]";
          if (bannerLink?.startsWith('/')) return <Link to={bannerLink} {...externalLinkProps} className={cls}>{img}</Link>;
          if (bannerLink) return <a href={bannerLink} target="_blank" rel="noopener noreferrer" className={cls}>{img}</a>;
          return <div className={cls}>{img}</div>;
        })()}

        {/* Flash Deals Horizontal Strip */}
        {!highlightLoading && allDeals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Flash Deals</h2>
              </div>
              <Link to="/top-deals" {...externalLinkProps} className="text-xs font-semibold text-indigo-600 flex items-center">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {allDeals.map((product, idx) => (
                <Link
                  key={`flash-${product._id}-${idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="flex-shrink-0 w-[130px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                    {product.discount > 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                        -{product.discount}%
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {Number(product.price || 0).toLocaleString()} F
                    </p>
                    {product.priceBeforeDiscount > product.price && (
                      <p className="text-[10px] text-gray-400 line-through">
                        {Number(product.priceBeforeDiscount).toLocaleString()} F
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Best Sellers Strip */}
        {!topSalesLoading && topSalesProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Meilleures ventes</h2>
              </div>
              <Link to="/top-sales" {...externalLinkProps} className="text-xs font-semibold text-indigo-600 flex items-center">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {topSalesProducts.slice(0, 6).map((product, idx) => (
                <Link
                  key={`bestseller-${product._id}-${idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="flex-shrink-0 w-[130px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                    {idx < 3 && (
                      <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ${
                        idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-600'
                      }`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div className="p-2">
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
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Boutiques vérifiées</h2>
              </div>
              <Link to="/shops/verified" {...externalLinkProps} className="text-xs font-semibold text-indigo-600 flex items-center">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
              {verifiedShops.map((shop) => (
                <Link
                  key={shop._id}
                  to={buildShopPath(shop)}
                  className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <img src={shop.shopLogo || '/api/placeholder/40/40'} alt={shop.shopName} className="w-9 h-9 rounded-lg object-cover border border-gray-100" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate max-w-[100px]">{shop.shopName}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">{shop.productCount || 0} annonces</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* City Products Strip */}
        {(() => {
          const firstCity = cityList.find(c => (cityHighlights[c] || []).length > 0);
          const cityProds = firstCity ? (cityHighlights[firstCity] || []).slice(0, 8) : [];
          if (!firstCity || !cityProds.length) return null;
          return (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-900">{firstCity}</h2>
                </div>
                <Link to={`/cities?city=${encodeURIComponent(firstCity)}`} {...externalLinkProps} className="text-xs font-semibold text-indigo-600 flex items-center">
                  Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
                </Link>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar" style={scrollStyle}>
                {cityProds.map((product, idx) => (
                  <Link
                    key={`city-m-${product._id}-${idx}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex-shrink-0 w-[130px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.97] transition-transform"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover" loading="lazy" />
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-semibold rounded-md bg-white/90 text-gray-600">
                        {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold text-gray-900 truncate">{Number(product.price || 0).toLocaleString()} F</p>
                      <p className="text-[10px] text-gray-500 truncate">{product.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* All Products Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Pour vous</h2>
            <p className="text-xs text-gray-500">{formatCount(totalProducts)} produits</p>
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
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">Aucun produit trouvé</p>
              <button
                onClick={() => { setCategory(''); setSort('new'); setPage(1); }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-full active:scale-95"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </section>

        {/* Discover More Quick Links */}
        <section className="pb-2">
          <h3 className="text-sm font-bold text-gray-900 mb-2.5">Découvrir plus</h3>
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/top-favorites"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-pink-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Top Favoris</span>
            </Link>
            <Link
              to="/top-ranking"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-600" fill="currentColor" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Top Notés</span>
            </Link>
            <Link
              to="/top-new"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-sky-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Neufs</span>
            </Link>
            <Link
              to="/top-used"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <RefreshCcw className="w-4 h-4 text-slate-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Occasion</span>
            </Link>
            <Link
              to="/certified-products"
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Certifiés</span>
            </Link>
            <Link
              to="/cities"
              {...externalLinkProps}
              className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-100 shadow-sm active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 text-center">Villes</span>
            </Link>
          </div>
        </section>
      </main>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <MobileSplash visible={showMobileSplash} logoSrc={appLogoMobile} label="HDMarket" />
      {isMobileView ? renderMobileHome() : (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* 🚀 HERO SECTION ENHANCED */}
        <section className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl overflow-hidden shadow-2xl">
          {heroBanner && (
            <div className="absolute inset-0">
              <img
                src={heroBanner}
                alt="Bannière HDMarket"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-indigo-950/70 to-purple-950/70" />
            </div>
          )}
          <div className="relative z-10 px-6 py-8 sm:py-12 lg:py-16 text-left">
            <div className="inline-flex items-center px-4 py-2 bg-white/15 backdrop-blur-md rounded-full border border-white/30 mb-6 shadow-lg">
              <Star className="w-4 h-4 text-yellow-300 mr-2 animate-pulse" fill="currentColor" />
              <span className="text-sm text-white font-semibold">Marketplace Premium</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-5 leading-tight">
              Votre Marché
              <span className="block bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 bg-clip-text text-transparent animate-gradient">
                Digital
              </span>
            </h1>

            <p className="text-base sm:text-lg text-indigo-100 mb-8 max-w-lg leading-relaxed font-medium">
              Découvrez <span className="font-bold text-yellow-300">{formatCount(totalProducts)}</span> produits vérifiés. Vendez et achetez en toute confiance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-start items-start">
              <Link
                to="/my"
                className="group inline-flex items-center px-6 py-3.5 bg-white text-gray-900 font-semibold rounded-3xl hover:bg-gray-50 transition-all duration-200 active:scale-95 shadow-sm text-base"
              >
                <Zap className="w-5 h-5 mr-2" />
                Publier un produit
              </Link>
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center px-6 py-3.5 bg-white/15 backdrop-blur-md text-white font-semibold rounded-3xl border border-white/30 hover:bg-white/25 transition-all duration-200 active:scale-95 text-base shadow-sm"
              >
                Explorer le marché
                <ChevronRight className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </div>
        </section>

        {promoBanner && (
          <section>
            {renderPromoBanner()}
          </section>
        )}

        {/* 🚚 PROMESSE LIVRAISON ENHANCED */}
        <section className="bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl border-2 border-emerald-200/50 shadow-xl p-6 sm:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg ring-4 ring-emerald-100">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                Livraison gratuite HDMarket
              </p>
              <h2 className="text-2xl font-black text-gray-900 mb-3">
                0 FCFA de frais dans la ville de la boutique, sous 48h
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">
                Dès que votre paiement est vérifié et la commande confirmée par nos équipes, nous livrons gratuitement
                dans la ville où se trouve la boutique en moins de 48h. Disponible à Brazzaville, Pointe-Noire, Oyo,
                Ouesso et bien plus encore.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 text-sm font-bold px-5 py-3 border-2 border-emerald-200 shadow-md">
              <Shield size={16} className="text-emerald-600" />
              Paiement confirmé
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 text-sm font-bold px-5 py-3 border-2 border-indigo-200 shadow-md">
              <Clock size={16} className="text-indigo-600" />
              Livraison 48h
            </span>
          </div>
        </section>

        {/* 🛡️ SECTION AVANTAGES ENHANCED */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Shield, title: "Sécurisé", desc: "Paiements protégés", color: "indigo" },
            { icon: Truck, title: "Livraison gratuite", desc: "< 48h dans la ville du vendeur", color: "emerald" },
            { icon: Award, title: "Qualité", desc: "Produits vérifiés", color: "amber" },
            { icon: Heart, title: "Confiance", desc: "Avis authentiques", color: "rose" }
          ].map((item, index) => {
            const colorClasses = {
              indigo: "bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-50",
              emerald: "bg-emerald-100 text-emerald-600 border-emerald-200 hover:bg-emerald-50",
              amber: "bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-50",
              rose: "bg-rose-100 text-rose-600 border-rose-200 hover:bg-rose-50"
            };
            const classes = colorClasses[item.color];
            return (
              <div key={index} className="group bg-white rounded-2xl p-5 text-center shadow-md border-2 border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
                <div className={`w-12 h-12 ${classes} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </section>

        {/* 🗂️ CATÉGORIES - DESIGN CUSTOM */}
        <section className="relative overflow-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200/60 dark:border-gray-700/50 shadow-lg" style={{ marginTop: '6px', marginBottom: '6px', paddingLeft: '20px', paddingRight: '20px', paddingTop: '23px', paddingBottom: '23px' }}>
            {/* Header avec style plus organique */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-900/30 border border-indigo-200/50 dark:border-indigo-800/50 w-fit">
                  <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Catégories</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  Explorez nos univers
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md">
                  Trouvez exactement ce que vous cherchez parmi nos collections soigneusement organisées
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-3xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm"
              >
                <span>Tout voir</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Grille de catégories avec design unique */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {categoryGroups.map((group, index) => {
                const Icon = group.icon;
                const targetSlug = group.options?.[0]?.value || '';
                
                // Couleurs uniques par catégorie pour un look plus personnalisé
                const categoryStyles = [
                  { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/50 dark:border-blue-800/50', hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30' },
                  { bg: 'bg-pink-50 dark:bg-pink-900/20', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200/50 dark:border-pink-800/50', hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/30' },
                  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200/50 dark:border-emerald-800/50', hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30' },
                  { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/50 dark:border-amber-800/50', hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30' },
                  { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200/50 dark:border-purple-800/50', hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30' },
                  { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400', border: 'border-red-200/50 dark:border-red-800/50', hover: 'hover:bg-red-100 dark:hover:bg-red-900/30' },
                  { bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200/50 dark:border-violet-800/50', hover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30' },
                  { bg: 'bg-slate-50 dark:bg-slate-900/20', icon: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200/50 dark:border-slate-800/50', hover: 'hover:bg-slate-100 dark:hover:bg-slate-900/30' }
                ];
                
                const style = categoryStyles[index % categoryStyles.length];
                
                return (
                  <Link
                    key={group.id}
                    to={`/categories/${targetSlug}`}
                    className={`group relative overflow-hidden rounded-2xl ${style.bg} border ${style.border} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-gray-900/50 active:scale-[0.98] ${style.hover}`}
                  >
                    <div className="p-5 sm:p-6 flex flex-col items-center gap-4">
                      {/* Icône avec effet de profondeur */}
                      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/80 dark:bg-gray-800/80 border-2 ${style.border} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-3 group-hover:scale-110`}>
                        <div className="absolute inset-0 rounded-2xl bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {Icon ? (
                          <Icon className={`relative w-8 h-8 sm:w-10 sm:h-10 ${style.icon} transition-transform duration-300 group-hover:scale-110`} />
                        ) : null}
                      </div>
                      
                      {/* Label avec style amélioré */}
                      <div className="text-center space-y-1">
                        <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors">
                          {group.label.split(' & ')[0]}
                        </p>
                        {group.label.includes(' & ') && (
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            {group.label.split(' & ')[1]}
                          </p>
                        )}
                      </div>
                      
                      {/* Indicateur de hover */}
                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${style.bg.replace('bg-', 'bg-').replace('-50', '-600').replace('-100', '-600')} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
        {isCategoryModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
            onClick={() => setCategoryModalOpen(false)}
          >
            <div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/50 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Header amélioré */}
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/50 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-900/30 border border-indigo-200/50 dark:border-indigo-800/50 w-fit mb-2">
                      <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Toutes les catégories</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Explorer nos univers</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Sélectionnez une catégorie pour découvrir nos produits</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryModalOpen(false)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors text-gray-600 dark:text-gray-400"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Contenu scrollable */}
              <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categoryGroups.map((group, index) => {
                    const Icon = group.icon;
                    
                    // Même système de couleurs que la section principale
                    const categoryStyles = [
                      { bg: 'from-blue-500/10 to-cyan-500/10', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200/50 dark:border-blue-800/50', hover: 'hover:from-blue-500/20 hover:to-cyan-500/20' },
                      { bg: 'from-pink-500/10 to-rose-500/10', icon: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200/50 dark:border-pink-800/50', hover: 'hover:from-pink-500/20 hover:to-rose-500/20' },
                      { bg: 'from-emerald-500/10 to-teal-500/10', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200/50 dark:border-emerald-800/50', hover: 'hover:from-emerald-500/20 hover:to-teal-500/20' },
                      { bg: 'from-amber-500/10 to-orange-500/10', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200/50 dark:border-amber-800/50', hover: 'hover:from-amber-500/20 hover:to-orange-500/20' },
                      { bg: 'from-purple-500/10 to-indigo-500/10', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200/50 dark:border-purple-800/50', hover: 'hover:from-purple-500/20 hover:to-indigo-500/20' },
                      { bg: 'from-red-500/10 to-rose-500/10', icon: 'text-red-600 dark:text-red-400', border: 'border-red-200/50 dark:border-red-800/50', hover: 'hover:from-red-500/20 hover:to-rose-500/20' },
                      { bg: 'from-violet-500/10 to-purple-500/10', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200/50 dark:border-violet-800/50', hover: 'hover:from-violet-500/20 hover:to-purple-500/20' },
                      { bg: 'from-slate-500/10 to-gray-500/10', icon: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200/50 dark:border-slate-800/50', hover: 'hover:from-slate-500/20 hover:to-gray-500/20' }
                    ];
                    
                    const style = categoryStyles[index % categoryStyles.length];
                    
                    return (
                      <Link
                        key={group.id}
                        to={`/categories/${group.options?.[0]?.value || ''}`}
                        onClick={() => setCategoryModalOpen(false)}
                        className={`group relative overflow-hidden rounded-2xl ${style.bg} border ${style.border} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] ${style.hover}`}
                      >
                        <div className="p-5 flex flex-col items-center gap-3 text-center">
                          <div className={`relative w-16 h-16 rounded-2xl bg-white/80 dark:bg-gray-800/80 border-2 ${style.border} flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:rotate-3 group-hover:scale-110`}>
                            <div className="absolute inset-0 rounded-2xl bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            {Icon ? (
                              <Icon className={`relative w-8 h-8 ${style.icon} transition-transform duration-300 group-hover:scale-110`} />
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                              {group.label}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                              {group.description}
                            </p>
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 h-1 ${style.bg.replace('bg-', 'bg-').replace('-50', '-600').replace('-100', '-600')} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔥 BONNES AFFAIRES - ENHANCED */}
        <section className="bg-gradient-to-br from-white to-red-50/20 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-red-100/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 via-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-red-100">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Bonnes Affaires</h2>
                <p className="text-gray-600 text-sm font-medium">Prix imbattables du moment</p>
              </div>
            </div>
            {!highlightLoading && highlights.topDeals.length > 0 && (
              <Link to="/top-deals" className="group inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm text-sm">
                Tout voir <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>

          {highlightLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg aspect-square mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : highlights.topDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {highlights.topDeals.slice(0, 6).map((product, idx) => (
                <div key={`top-deal-${product._id}-${idx}`} className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl border-2 border-gray-100 hover:border-red-200 transition-all duration-300">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-square overflow-hidden">
                    <img
                      src={product.images?.[0] || "/api/placeholder/200/200"}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {product.discount > 0 && (
                      <div className="absolute top-3 left-3 bg-gradient-to-br from-red-500 to-red-600 text-white text-sm font-black px-3 py-1.5 rounded-xl shadow-xl ring-2 ring-white/50">
                        -{product.discount}%
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    {/* PRIX BIEN VISIBLE */}
                    <div className="mb-3">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="text-xl font-black text-gray-900">
                          {Number(product.price || 0).toLocaleString()} FCFA
                        </span>
                        {product.priceBeforeDiscount > product.price && (
                          <span className="text-sm text-gray-500 line-through font-medium">
                            {Number(product.priceBeforeDiscount).toLocaleString()} FCFA
                          </span>
                        )}
                      </div>
                      {product.discount > 0 && (
                        <div className="text-sm text-red-600 font-bold">
                          Économisez {Math.round((product.priceBeforeDiscount - product.price) / 100) * 100} FCFA
                        </div>
                      )}
                    </div>

                    {/* LIEN DIRECT VERS LE PRODUIT */}
                    <Link
                      to={buildHomeProductLink(product)}
                      {...externalLinkProps}
                      className="block w-full text-center bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-bold py-3 rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      Voir l'offre
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">Aucune bonne affaire pour le moment</p>
            </div>
          )}
        </section>

        {/* 🏷️ PRODUITS EN PROMOTION - ENHANCED */}
        <section className="bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-emerald-100/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-emerald-100">
                <Tag className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Produits en Promotion</h2>
                <p className="text-gray-600 text-sm font-medium">Réductions exceptionnelles</p>
              </div>
            </div>
            {!discountLoading && discountProducts.length > 0 && (
              <Link 
                to="/top-discounts" 
                className="group inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm text-sm"
              >
                Tout voir <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>

          {discountLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg aspect-square mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : discountProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {discountProducts.slice(0, 8).map((product, idx) => (
                <div key={`discount-${product._id}-${idx}`} className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl border-2 border-gray-100 hover:border-emerald-200 transition-all duration-300">
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-square overflow-hidden">
                    <img
                      src={product.images?.[0] || "/api/placeholder/200/200"}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* BADGE DE PROMOTION BIEN VISIBLE */}
                    <div className="absolute top-3 left-3 bg-gradient-to-br from-emerald-500 to-green-600 text-white text-sm font-black px-3 py-1.5 rounded-xl shadow-xl ring-2 ring-white/50">
                      -{product.discount}%
                    </div>
                    {/* COMPTEUR D'ÉCONOMIE */}
                    <div className="absolute top-3 right-3 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg">
                      ÉCONOMIE
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {/* INFORMATIONS PRODUIT */}
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                        {product.title}
                      </h3>
                      
                      {/* PRIX AVEC RÉDUCTION BIEN VISIBLE */}
                      <div className="space-y-2">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-lg font-black text-gray-900">
                            {Number(product.price || 0).toLocaleString()} FCFA
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 line-through font-medium">
                            {Number(product.priceBeforeDiscount).toLocaleString()} FCFA
                          </span>
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                            Économie {Math.round((product.priceBeforeDiscount - product.price) / 100) * 100} FCFA
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* LIEN DIRECT VERS LE PRODUIT */}
                    <Link
                      to={buildHomeProductLink(product)}
                      {...externalLinkProps}
                      className="block w-full text-center bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-bold py-3 rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                    >
                      Profiter de l'offre
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">Aucune promotion en cours</p>
              <p className="text-xs text-gray-400 mt-1">Revenez bientôt pour découvrir nos offres</p>
            </div>
          )}
        </section>

        {/* 🏆 PRODUITS LES PLUS VENDUS - ENHANCED */}
        <section className="bg-gradient-to-br from-white to-orange-50/20 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-orange-100/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-orange-100">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">Produits les plus vendus</h2>
                <p className="text-gray-600 text-sm font-medium">Best-sellers basés sur les ventes réelles</p>
              </div>
            </div>
            {!topSalesLoading && topSalesProducts.length > 0 && (
              <Link 
                to="/top-sales" 
                className="group inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm text-sm"
              >
                Tout voir <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            )}
          </div>

          {topSalesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="animate-pulse">
                  <div className="bg-gray-200 rounded-lg aspect-square mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : topSalesProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {topSalesProducts.slice(0, 6).map((product, idx) => (
                <div key={`top-sales-${product._id}-${idx}`} className="relative group">
                  {/* Ranking Badge Enhanced */}
                  {idx < 3 && (
                    <div className="absolute -top-3 -left-3 z-30">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white ${
                        idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500' :
                        idx === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        'bg-gradient-to-br from-amber-500 to-amber-600'
                      }`}>
                        <Award className="w-6 h-6 text-white" />
                      </div>
                      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white/80 flex items-center justify-center text-xs font-black">
                        {idx + 1}
                      </div>
                    </div>
                  )}
                  <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl border-2 border-gray-100 hover:border-orange-200 transition-all duration-300 transform hover:scale-105">
                    <ProductCard
                      p={product}
                      productLink={buildHomeProductLink(product)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">Aucun produit vendu pour le moment</p>
              <p className="text-xs text-gray-400 mt-1">Les best-sellers apparaîtront ici une fois que des commandes seront confirmées</p>
            </div>
          )}
        </section>

        {/* 🌆 PRODUITS PAR VILLE */}
        {cityList.map((city) => {
          const products = (cityHighlights[city] || []).slice(0, 8);
          if (!products.length) return null;
          return (
            <section
              key={city}
              className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{city}</h2>
                    <p className="text-gray-500 text-xs">Annonces publiées depuis {city}</p>
                  </div>
                </div>
                <Link
                  to={`/cities?city=${encodeURIComponent(city)}`}
                  {...externalLinkProps}
                  className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold flex items-center"
                >
                  Tout voir <ChevronRight className="w-3 h-3 ml-1" />
                </Link>
              </div>

              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                spaceBetween={16}
                slidesPerView={1}
                navigation
                pagination={{ clickable: true }}
                autoplay={{ delay: 4500, disableOnInteraction: false }}
                breakpoints={{
                  640: { slidesPerView: 2 },
                  1024: { slidesPerView: 4 }
                }}
              >
                {products.map((product, index) => (
                  <SwiperSlide key={`city-${city}-${product._id}-${index}`}>
                    <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-2 h-full">
                      <Link
                        to={buildHomeProductLink(product)}
                        {...externalLinkProps}
                        className="relative block"
                      >
                        <img
                          src={product.images?.[0] || "/api/placeholder/200/200"}
                          alt={product.title}
                          className="w-full aspect-square rounded-xl object-cover"
                        />
                        {product.discount > 0 && (
                          <span className="absolute top-2 left-2 px-2 py-1 text-[10px] font-semibold rounded-full bg-rose-500 text-white">
                            -{product.discount}%
                          </span>
                        )}
                          <span className="absolute top-2 right-2 px-2 py-1 text-[10px] font-semibold rounded-full bg-white/90 text-gray-700">
                            {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                          </span>
                      </Link>

                      <div className="flex items-center justify-between text-sm font-bold text-gray-900">
                        <span>{Number(product.price || 0).toLocaleString()} FCFA</span>
                        {product.priceBeforeDiscount > product.price && (
                          <span className="text-xs text-gray-500 font-medium line-through">
                            {Number(product.priceBeforeDiscount).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{product.title}</h3>
                      {product.shopName && (
                        <p className="text-xs text-gray-500 flex items-center justify-between">
                          <span>{product.shopName}</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">
                            {product.condition === 'new' ? 'Neuf' : 'Occasion'}
                          </span>
                        </p>
                      )}

                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </section>
          );
        })}

        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Explorer toutes les villes</h2>
              <p className="text-xs text-gray-500">
                Retrouvez la liste complète des annonces par ville et découvrez les vendeurs proches de vous.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/cities"
                {...externalLinkProps}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Parcourir les villes
              </Link>
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-gray-50"
              >
                Voir tous les produits
              </Link>
            </div>
          </div>
        </section>

        {/* 🏆 TOP PRODUITS */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top Favoris */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-pink-600 rounded-xl flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Top Favoris</h3>
                  <p className="text-gray-500 text-xs">Les plus enregistrés</p>
                </div>
              </div>
              <Link to="/top-favorites" className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold">
                Voir tout
              </Link>
            </div>

            {highlightLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : highlights.favorites.length > 0 ? (
              <div className="space-y-3 flex-1">
                {highlights.favorites.slice(0, 3).map((product, index) => (
                  <Link
                    key={`favorite-${product._id}-${index}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-6">
                      <span className={`text-xs font-bold ${
                        index === 0 ? "text-yellow-500" :
                        index === 1 ? "text-gray-400" :
                        "text-amber-600"
                      }`}>
                        #{index + 1}
                      </span>
                    </div>
                    <img
                      src={product.images?.[0] || "/api/placeholder/60/60"}
                      alt={product.title}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                        {product.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {Number(product.price || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1 text-xs text-gray-500">
                        <Heart className="w-3 h-3 text-rose-500" fill="currentColor" />
                        <span>{product.favoritesCount || 0}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs">Soyez le premier à ajouter en favoris !</p>
              </div>
            )}
          </div>

          {/* Top Notés */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-amber-600 rounded-xl flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" fill="currentColor" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Top Notés</h3>
                  <p className="text-gray-500 text-xs">Les mieux évalués</p>
                </div>
              </div>
              <Link to="/top-ranking" className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold">
                Voir tout
              </Link>
            </div>

            {highlightLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : highlights.topRated.length > 0 ? (
              <div className="space-y-3 flex-1">
                {highlights.topRated.slice(0, 3).map((product, index) => (
                  <Link
                    key={`top-rated-${product._id}-${index}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-6">
                      <span className={`text-xs font-bold ${
                        index === 0 ? "text-yellow-500" :
                        index === 1 ? "text-gray-400" :
                        "text-amber-600"
                      }`}>
                        #{index + 1}
                      </span>
                    </div>
                    <img
                      src={product.images?.[0] || "/api/placeholder/60/60"}
                      alt={product.title}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                        {product.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {Number(product.price || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1 text-xs">
                        <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                        <span className="font-semibold text-gray-900">
                          {Number(product.ratingAverage || 0).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">{product.ratingCount || 0} avis</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs">Les premières évaluations arrivent bientôt !</p>
              </div>
            )}
          </div>

          </div>

          {/* Produits Neufs */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-sky-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Produits Neufs</h3>
                  <p className="text-gray-500 text-xs">Dernières nouveautés en boutique</p>
                </div>
              </div>
              <Link to="/top-new" className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold">
                Voir tout
              </Link>
            </div>

            {highlightLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : highlights.newProducts.length > 0 ? (
              <div className="space-y-3">
                {highlights.newProducts.slice(0, 3).map((product, index) => (
                  <Link
                    key={`new-${product._id}-${index}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <img
                      src={product.images?.[0] || "/api/placeholder/60/60"}
                      alt={product.title}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                        {product.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {Number(product.price || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-semibold text-indigo-600">Neuf</p>
                      <p className="text-[10px]">Ajouté récemment</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs">Aucun produit neuf pour le moment.</p>
              </div>
            )}
          </div>

          {/* Produits d'occasion */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-slate-600 rounded-xl flex items-center justify-center">
                  <RefreshCcw className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Produits d'occasion</h3>
                  <p className="text-gray-500 text-xs">Sélection vérifiée par la communauté</p>
                </div>
              </div>
              <Link to="/top-used" className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold">
                Voir tout
              </Link>
            </div>

            {highlightLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="flex items-center space-x-3 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : highlights.usedProducts.length > 0 ? (
              <div className="space-y-3">
                {highlights.usedProducts.slice(0, 3).map((product, index) => (
                  <Link
                    key={`used-${product._id}-${index}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <img
                      src={product.images?.[0] || "/api/placeholder/60/60"}
                      alt={product.title}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                        {product.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {Number(product.price || 0).toLocaleString()} FCFA
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-semibold text-slate-600">Occasion</p>
                      <p className="text-[10px]">Bon état garanti</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <RefreshCcw className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs">Aucune annonce d'occasion pour l'instant.</p>
              </div>
            )}
          </div>
        </section>

        {/* 🎯 FILTRES ET TRI RAPIDE - ENHANCED */}
        <section className="bg-gradient-to-br from-white to-indigo-50/20 rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-indigo-100/50">
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-bold text-indigo-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Filtrer les meilleures offres
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: '', label: 'Toutes' },
                  { value: 'electronics', label: 'Électronique' },
                  { value: 'fashion', label: 'Mode' },
                  { value: 'home', label: 'Maison' },
                  { value: 'sports', label: 'Sports' }
                ].map((option) => (
                  <button
                    key={option.value || 'all'}
                    type="button"
                    onClick={() => {
                      setCategory(option.value);
                      setPage(1);
                    }}
                    className={`px-5 py-2.5 rounded-3xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
                      category === option.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trier par
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'new', label: 'Nouveautés' },
                  { value: 'price_asc', label: 'Prix ↑' },
                  { value: 'price_desc', label: 'Prix ↓' },
                  { value: 'discount', label: 'Remises' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSort(option.value);
                      setPage(1);
                    }}
                    className={`px-5 py-2.5 rounded-3xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
                      sort === option.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 🛡️ BOUTIQUES VÉRIFIÉES */}
        {verifiedLoading ? (
          <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Chargement des boutiques vérifiées…</p>
          </section>
        ) : verifiedShops.length ? (
          <section className="bg-indigo-50 rounded-2xl p-4 sm:p-6 shadow-sm border border-indigo-100 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Boutiques vérifiées
                </h2>
                <p className="text-sm text-gray-500">
                  Vendeurs certifiés par ETS HD Tech Filial
                </p>
              </div>
              <Link
                to="/shops/verified"
                className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Voir toutes les boutiques
                <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {verifiedShops.map((shop) => (
                <Link
                  key={shop._id}
                  to={buildShopPath(shop)}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all bg-white p-4"
                >
                  <img
                    src={shop.shopLogo || '/api/placeholder/60/60'}
                    alt={shop.shopName}
                    className="h-12 w-12 rounded-xl object-cover border border-indigo-100"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{shop.shopName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {shop.shopAddress || 'Adresse non renseignée'}
                    </p>
                    <div className="text-xs text-emerald-600 font-semibold mt-1">
                      {shop.productCount || 0} annonce{shop.productCount > 1 ? 's' : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
        </section>
        ) : null}

        {certifiedProducts.length > 0 ? (
          <section className="bg-emerald-50 rounded-2xl p-4 sm:p-6 shadow-sm border border-emerald-100 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Produits certifiés
                </h2>
                <p className="text-sm text-gray-500">
                  Les annonces garanties HDMarket par nos équipes de vérification.
                </p>
              </div>
              <Link
                to="/certified-products"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Voir tous les certifiés
                <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {certifiedProducts.map((product, index) => (
                <Link
                  key={`certified-${product._id}-${index}`}
                  to={buildHomeProductLink(product)}
                  className="rounded-2xl border border-gray-100 bg-white p-3 text-xs text-gray-700 hover:border-indigo-200 hover:shadow-lg transition"
                >
                  <div className="flex items-start gap-2">
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={product.images?.[0] || '/api/placeholder/80/80'}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-600">Certifié</p>
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.title}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{Number(product.price).toLocaleString()} FCFA</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 📦 TOUS LES PRODUITS AVEC PAGINATION - ENHANCED */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Tous les Produits</h2>
              <p className="text-gray-600 text-sm font-medium">
                <span className="font-bold text-indigo-600">{items.length}</span> produits disponibles
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl h-64 shadow-md"></div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-5">
                {items.map((product, index) => (
                  <div 
                    key={`product-${product._id}-${index}`} 
                    className="transform hover:scale-105 transition-transform duration-300 w-full h-full"
                  >
                    <ProductCard
                      p={product}
                      productLink={buildHomeProductLink(product)}
                    />
                  </div>
                ))}
              </div>

              {/* PAGINATION MOBILE-FIRST */}
              {renderPagination()}
            </>
          ) : (
            <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-white rounded-3xl border-2 border-gray-200 shadow-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-3">Aucun produit trouvé</h3>
              <p className="text-gray-600 text-base mb-6 font-medium">
                Modifiez vos critères de filtrage
              </p>
              <button
                onClick={() => {
                  setCategory("");
                  setSort("new");
                  setPage(1);
                }}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-3xl hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm text-base"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
