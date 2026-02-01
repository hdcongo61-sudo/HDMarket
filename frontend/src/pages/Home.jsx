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
  const [topProductsTab, setTopProductsTab] = useState('favorites');
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
            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
            >
              <span className="font-black tabular-nums">{formatCount(totalProducts)}</span>
              <span className="text-gray-600 font-medium">produits</span>
              <ChevronRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
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

  // === DESKTOP WIDE MULTI-ZONE LAYOUT (Proposal A) ===
  const renderDesktopHome = () => {
    const allDeals = [
      ...highlights.topDeals.slice(0, 4),
      ...discountProducts.filter(p => !highlights.topDeals.some(d => d._id === p._id)).slice(0, 4)
    ].slice(0, 4);

    const topProductsTabData = {
      favorites: { items: highlights.favorites, icon: Heart, label: 'Top Favoris', link: '/top-favorites', iconColor: 'text-pink-600', bgColor: 'bg-pink-600' },
      topRated: { items: highlights.topRated, icon: Star, label: 'Top Notés', link: '/top-ranking', iconColor: 'text-amber-600', bgColor: 'bg-amber-600' },
      newProducts: { items: highlights.newProducts, icon: Sparkles, label: 'Neufs', link: '/top-new', iconColor: 'text-sky-600', bgColor: 'bg-sky-600' },
      usedProducts: { items: highlights.usedProducts, icon: RefreshCcw, label: 'Occasion', link: '/top-used', iconColor: 'text-slate-600', bgColor: 'bg-slate-600' }
    };
    const activeTabData = topProductsTabData[topProductsTab] || topProductsTabData.favorites;

    return (
      <main className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-6 lg:px-8 py-5 space-y-5">
        {/* Category Pills Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar items-center">
          <Link
            to="/products"
            {...externalLinkProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-bold whitespace-nowrap shadow-sm hover:bg-indigo-700 transition-colors"
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-700 whitespace-nowrap shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                {Icon && <Icon className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
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

        {/* Zone 1: Hero (65%) + Flash Deals Panel (35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* Hero Banner */}
          <div className="flex flex-col gap-4">
            <section className="relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl overflow-hidden shadow-lg" style={{ minHeight: '300px' }}>
              {heroBanner && (
                <div className="absolute inset-0">
                  <img src={heroBanner} alt="Bannière HDMarket" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-indigo-950/70 to-purple-950/70" />
                </div>
              )}
              <div className="relative z-10 px-6 py-8 lg:py-10 text-left">
                <div className="inline-flex items-center px-3 py-1.5 bg-white/15 backdrop-blur-md rounded-full border border-white/30 mb-4 shadow-lg">
                  <Star className="w-3.5 h-3.5 text-yellow-300 mr-1.5" fill="currentColor" />
                  <span className="text-xs text-white font-semibold">Marketplace Premium</span>
                </div>
                <h1 className="text-3xl lg:text-4xl font-black text-white mb-3 leading-tight">
                  Votre Marché
                  <span className="block bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 bg-clip-text text-transparent">Digital</span>
                </h1>
                <p className="text-sm text-indigo-100 mb-5 max-w-md leading-relaxed">
                  Découvrez <span className="font-bold text-yellow-300">{formatCount(totalProducts)}</span> produits vérifiés. Vendez et achetez en toute confiance.
                </p>
                <div className="flex gap-3">
                  <Link to="/my" className="inline-flex items-center px-5 py-2.5 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-50 transition-all text-sm shadow-sm">
                    <Zap className="w-4 h-4 mr-1.5" /> Publier
                  </Link>
                  <Link to="/products" {...externalLinkProps} className="inline-flex items-center px-5 py-2.5 bg-white/15 backdrop-blur-md text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-sm">
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
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Flash Deals</h2>
              </div>
              <Link to="/top-deals" {...externalLinkProps} className="text-xs font-semibold text-indigo-600 flex items-center hover:text-indigo-500">
                Voir tout <ChevronRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
            {highlightLoading ? (
              <div className="grid grid-cols-2 gap-3 flex-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-xl aspect-square" />
                ))}
              </div>
            ) : allDeals.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 flex-1">
                {allDeals.map((product, idx) => (
                  <Link
                    key={`deal-panel-${product._id}-${idx}`}
                    to={buildHomeProductLink(product)}
                    {...externalLinkProps}
                    className="group bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      {product.discount > 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">-{product.discount}%</span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-bold text-gray-900">{Number(product.price || 0).toLocaleString()} F</p>
                      {product.priceBeforeDiscount > product.price && (
                        <p className="text-[10px] text-gray-400 line-through">{Number(product.priceBeforeDiscount).toLocaleString()} F</p>
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

        {/* Zone 2: Best Sellers Row (5 columns) */}
        {!topSalesLoading && topSalesProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Meilleures ventes</h2>
              </div>
              <Link to="/top-sales" {...externalLinkProps} className="text-sm font-semibold text-indigo-600 flex items-center hover:text-indigo-500">
                Voir tout <ChevronRight className="w-4 h-4 ml-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
              {topSalesProducts.slice(0, 5).map((product, idx) => (
                <Link
                  key={`bestseller-d-${product._id}-${idx}`}
                  to={buildHomeProductLink(product)}
                  {...externalLinkProps}
                  className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    {idx < 3 && (
                      <span className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg ${
                        idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-600'
                      }`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-700 truncate">{product.title}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{Number(product.price || 0).toLocaleString()} FCFA</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Zone 3: Shops (35%) + Tabbed Top Products (65%) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-5">
          {/* Verified Shops Panel */}
          <section className="bg-indigo-50/60 rounded-2xl border border-indigo-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Boutiques vérifiées</h2>
              </div>
              <Link to="/shops/verified" {...externalLinkProps} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
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
                    className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all p-3"
                  >
                    <img src={shop.shopLogo || '/api/placeholder/40/40'} alt={shop.shopName} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{shop.shopName}</p>
                      <p className="text-xs text-gray-500 truncate">{shop.shopAddress || 'Adresse non renseignée'}</p>
                    </div>
                    <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">{shop.productCount || 0} annonces</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">Aucune boutique vérifiée</div>
            )}
          </section>

          {/* Tabbed Top Products Widget */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Tendances</h2>
              <Link to={activeTabData.link} {...externalLinkProps} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center">
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
                    className="group bg-gray-50 rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all"
                  >
                    <div className="relative aspect-square bg-gray-100">
                      <img src={product.images?.[0] || '/api/placeholder/200/200'} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      <span className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-700 truncate group-hover:text-indigo-600 transition-colors">{product.title}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{Number(product.price || 0).toLocaleString()} FCFA</p>
                      {topProductsTab === 'favorites' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Heart className="w-3 h-3 text-rose-500" fill="currentColor" />
                          <span>{product.favoritesCount || 0}</span>
                        </div>
                      )}
                      {topProductsTab === 'topRated' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                          <span className="font-semibold text-gray-700">{Number(product.ratingAverage || 0).toFixed(1)}</span>
                          <span>({product.ratingCount || 0})</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">Aucun produit dans cette catégorie</div>
            )}
          </section>
        </div>

        {/* Découvrir plus: quick-links to dedicated pages */}
        <section className="hidden lg:block">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-600">Découvrir plus</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/cities"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
            >
              <MapPin className="w-4 h-4" />
              Par ville
            </Link>
            <Link
              to="/top-favorites"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
            >
              <Heart className="w-4 h-4" />
              Favoris
            </Link>
            <Link
              to="/top-ranking"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
            >
              <Star className="w-4 h-4" />
              Mieux notés
            </Link>
            <Link
              to="/top-new"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Nouveautés
            </Link>
            <Link
              to="/top-used"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
            >
              <Clock className="w-4 h-4" />
              Occasions
            </Link>
            <Link
              to="/certified-products"
              {...externalLinkProps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 text-gray-700 hover:text-indigo-700 font-medium text-sm transition-all"
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
            <h2 className="text-xl font-bold text-gray-900">
              Tous les produits
              <span className="text-sm font-normal text-gray-500 ml-2">({formatCount(totalProducts)})</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sort dropdown */}
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                <option value="new">Nouveautés</option>
                <option value="price_asc">Prix croissant</option>
                <option value="price_desc">Prix décroissant</option>
                <option value="discount">Remises</option>
              </select>
              {/* Category filter */}
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Toutes catégories</option>
                <option value="electronics">Électronique</option>
                <option value="fashion">Mode</option>
                <option value="home">Maison</option>
                <option value="sports">Sports</option>
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
              <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun produit trouvé</h3>
              <p className="text-gray-500 text-sm mb-4">Modifiez vos critères de filtrage</p>
              <button
                onClick={() => { setCategory(''); setSort('new'); setPage(1); }}
                className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
              >
                Réinitialiser les filtres
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
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/50 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
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
            <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {categoryGroups.map((group, index) => {
                  const Icon = group.icon;
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
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.bg} border ${style.border} backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] ${style.hover}`}
                    >
                      <div className="p-5 flex flex-col items-center gap-3 text-center">
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
