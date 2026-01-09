import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import categoryGroups from "../data/categories";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Search, Star, TrendingUp, Zap, Shield, Truck, Award, Heart, ChevronRight, Tag, Sparkles, RefreshCcw, MapPin, LayoutGrid, Clock } from "lucide-react";
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
  const [verifiedShops, setVerifiedShops] = useState([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [heroBanner, setHeroBanner] = useState('');
  const [promoBanner, setPromoBanner] = useState('');
  const [promoBannerLink, setPromoBannerLink] = useState('');
  const [promoBannerStartAt, setPromoBannerStartAt] = useState('');
  const [promoBannerEndAt, setPromoBannerEndAt] = useState('');
  const [promoNow, setPromoNow] = useState(() => new Date());
const cityList = ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
const externalLinkProps = useDesktopExternalLink();
const formatCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
  const defaultPromoBanner = '/promo-default.svg';
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
      
      setItems((prev) => (isMobileView && page > 1 ? [...prev, ...fetchedItems] : fetchedItems));
      setTotalPages(pages);
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
    const loadPromoBanner = async () => {
      try {
        const { data } = await api.get('/settings/promo-banner');
        if (!active) return;
        setPromoBanner(data?.promoBanner || '');
        setPromoBannerLink(data?.promoBannerLink || '');
        setPromoBannerStartAt(data?.promoBannerStartAt || '');
        setPromoBannerEndAt(data?.promoBannerEndAt || '');
      } catch (error) {
        if (!active) return;
        setPromoBanner('');
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
    const bannerSrc = isPromoActive ? promoBanner : defaultPromoBanner;
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
      "group block w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm";
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

  useEffect(() => {
    loadHighlights();
    loadDiscountProducts();
    loadVerifiedShops();
    loadCertifiedProducts();
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

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* 🚀 HERO SECTION MOBILE-FIRST */}
        <section className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 rounded-2xl overflow-hidden shadow-lg">
          {heroBanner && (
            <div className="absolute inset-0">
              <img
                src={heroBanner}
                alt="Bannière HDMarket"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-slate-950/65" />
            </div>
          )}
          <div className="relative z-10 px-4 py-6 sm:py-10 text-left">
            <div className="inline-flex items-center px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-4">
              <Star className="w-3 h-3 text-yellow-300 mr-1" fill="currentColor" />
              <span className="text-xs text-white font-medium">Marketplace Premium</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
              Votre Marché
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Digital
              </span>
            </h1>

            <p className="text-sm text-indigo-100 mb-6 max-w-md leading-relaxed">
              Découvrez des milliers de produits vérifiés. Vendez et achetez en toute confiance.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-start items-start">
              <Link
                to="/my"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-bold rounded-xl hover:from-yellow-300 hover:to-orange-300 transition-all transform hover:scale-105 shadow-lg text-sm"
              >
                <Zap className="w-4 h-4 mr-2" />
                Publier un produit
              </Link>
              <Link
                to="/products"
                {...externalLinkProps}
                className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-sm"
              >
                Explorer le marché
              </Link>
            </div>
          </div>
        </section>

        {promoBanner && (
          <section>
            {renderPromoBanner()}
          </section>
        )}

        {/* 🚚 PROMESSE LIVRAISON */}
        <section className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-inner">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                Livraison gratuite HDMarket
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                0 FCFA de frais dans la ville de la boutique, sous 48h
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Dès que votre paiement est vérifié et la commande confirmée par nos équipes, nous livrons gratuitement
                dans la ville où se trouve la boutique en moins de 48h. Disponible à Brazzaville, Pointe-Noire, Oyo,
                Ouesso et bien plus encore.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 text-xs font-semibold px-4 py-2 border border-green-100">
              <Shield size={14} />
              Paiement confirmé
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold px-4 py-2 border border-indigo-100">
              <Clock size={14} />
              Livraison 48h
            </span>
          </div>
        </section>

        {/* 🛡️ SECTION AVANTAGES COMPACTS */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Shield, title: "Sécurisé", desc: "Paiements protégés" },
            { icon: Truck, title: "Livraison gratuite", desc: "< 48h dans la ville du vendeur" },
            { icon: Award, title: "Qualité", desc: "Produits vérifiés" },
            { icon: Heart, title: "Confiance", desc: "Avis authentiques" }
          ].map((item, index) => (
            <div key={index} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                <item.icon className="w-4 h-4 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-xs mb-1">{item.title}</h3>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          ))}
        </section>

        {/* 🗂️ CATÉGORIES - STYLE ALIBABA */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                <LayoutGrid className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Explorer par catégories</h2>
                <p className="text-xs text-gray-500">
                  Découvrez les univers populaires et accédez aux sélections par icône.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="text-xs font-semibold uppercase tracking-wide text-indigo-600 hover:text-indigo-500"
            >
              Voir toutes les catégories
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categoryGroups.map((group) => {
              const Icon = group.icon;
              const targetSlug = group.options?.[0]?.value || '';
              return (
                <Link
                  key={group.id}
                  to={`/categories/${targetSlug}`}
                  className="flex flex-col items-center gap-3 text-center transition-transform hover:-translate-y-1"
                >
                  <div className="h-20 w-20 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center transition-colors hover:border-indigo-200">
                    {Icon ? <Icon className="h-7 w-7 text-indigo-600" /> : null}
                  </div>
                  <p className="text-xs font-semibold text-gray-900">{group.label}</p>
                </Link>
              );
            })}
          </div>
        </section>
        {isCategoryModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4"
            onClick={() => setCategoryModalOpen(false)}
          >
            <div
              className="h-full w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Explorer les catégories</p>
                  <p className="text-xs text-gray-500">Touchez une icône pour accéder aux sous-catégories</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
                >
                  Fermer
                </button>
              </div>
              <div className="max-h-[90vh] overflow-y-auto px-4 py-4 pb-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {categoryGroups.map((group) => {
                    const Icon = group.icon;
                    return (
                      <Link
                        key={group.id}
                        to={`/categories/${group.options?.[0]?.value || ''}`}
                        onClick={() => setCategoryModalOpen(false)}
                        className="flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center shadow-sm transition hover:border-indigo-200 hover:bg-white"
                      >
                        <div className="h-14 w-14 rounded-full border border-gray-200 bg-white flex items-center justify-center">
                          {Icon ? <Icon className="h-6 w-6 text-indigo-600" /> : null}
                        </div>
                        <p className="text-xs font-semibold text-gray-900">{group.label}</p>
                        <p className="text-[11px] text-gray-500">{group.description}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔥 BONNES AFFAIRES - DESIGN ALIBABA */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bonnes Affaires</h2>
                <p className="text-gray-500 text-xs">Prix imbattables du moment</p>
              </div>
            </div>
            {!highlightLoading && highlights.topDeals.length > 0 && (
              <Link to="/top-deals" className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold flex items-center">
                Tout voir <ChevronRight className="w-3 h-3 ml-1" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {highlights.topDeals.slice(0, 6).map((product, idx) => (
                <div key={`top-deal-${product._id}-${idx}`} className="group">
                  <div className="relative bg-gray-100 rounded-lg aspect-square overflow-hidden mb-2">
                    <img
                      src={product.images?.[0] || "/api/placeholder/200/200"}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {product.discount > 0 && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                        -{product.discount}%
                      </div>
                    )}
                  </div>
                  
                  {/* PRIX BIEN VISIBLE */}
                  <div className="mb-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-bold text-gray-900">
                        {Number(product.price || 0).toLocaleString()} FCFA
                      </span>
                      {product.priceBeforeDiscount > product.price && (
                        <span className="text-xs text-gray-500 line-through">
                          {Number(product.priceBeforeDiscount).toLocaleString()} FCFA
                        </span>
                      )}
                    </div>
                    {product.discount > 0 && (
                      <div className="text-xs text-red-500 font-semibold">
                        Économisez {Math.round((product.priceBeforeDiscount - product.price) / 100) * 100} FCFA
                      </div>
                    )}
                  </div>

                  {/* LIEN DIRECT VERS LE PRODUIT */}
                  <Link
                    to={buildProductPath(product)}
                    {...externalLinkProps}
                    className="block w-full text-center bg-indigo-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Voir l'offre
                  </Link>
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

        {/* 🏷️ PRODUITS EN PROMOTION - NOUVELLE SECTION */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <Tag className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Produits en Promotion</h2>
                <p className="text-gray-500 text-xs">Réductions exceptionnelles</p>
              </div>
            </div>
            {!discountLoading && discountProducts.length > 0 && (
              <Link 
                to="/top-discounts" 
                className="text-indigo-600 hover:text-indigo-500 text-xs font-semibold flex items-center"
              >
                Tout voir <ChevronRight className="w-3 h-3 ml-1" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {discountProducts.slice(0, 8).map((product, idx) => (
                <div key={`discount-${product._id}-${idx}`} className="group">
                  <div className="relative bg-gray-100 rounded-lg aspect-square overflow-hidden mb-2">
                    <img
                      src={product.images?.[0] || "/api/placeholder/200/200"}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* BADGE DE PROMOTION BIEN VISIBLE */}
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      -{product.discount}%
                    </div>
                    {/* COMPTEUR D'ÉCONOMIE */}
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1 py-0.5 rounded">
                      ÉCONOMIE
                    </div>
                  </div>
                  
                  {/* INFORMATIONS PRODUIT */}
                  <div className="mb-2">
                    <h3 className="font-medium text-gray-900 text-xs mb-1 line-clamp-2 h-8">
                      {product.title}
                    </h3>
                    
                    {/* PRIX AVEC RÉDUCTION BIEN VISIBLE */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-bold text-gray-900">
                          {Number(product.price || 0).toLocaleString()} FCFA
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 line-through">
                          {Number(product.priceBeforeDiscount).toLocaleString()} FCFA
                        </span>
                        <span className="text-xs font-bold text-green-600">
                          Économie {Math.round((product.priceBeforeDiscount - product.price) / 100) * 100} FCFA
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* LIEN DIRECT VERS LE PRODUIT */}
                  <Link
                    to={buildProductPath(product)}
                    {...externalLinkProps}
                    className="block w-full text-center bg-green-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Profiter de l'offre
                  </Link>
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
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
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
                        to={buildProductPath(product)}
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
                <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
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
                    to={buildProductPath(product)}
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
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
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
                    to={buildProductPath(product)}
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
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-indigo-500 rounded-xl flex items-center justify-center">
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
                    to={buildProductPath(product)}
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
                <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center">
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
                    to={buildProductPath(product)}
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

        {/* 🎯 FILTRES ET TRI RAPIDE */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Filtrer les meilleures offres
              </p>
              <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      category === option.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Trier par
              </p>
              <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      sort === option.value
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-100 rounded-2xl p-4 sm:p-6 shadow-sm border border-indigo-100 space-y-4">
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
                  className="flex items-center gap-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all bg-gradient-to-r from-white to-indigo-50/30 p-4"
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
          <section className="bg-gradient-to-br from-emerald-50 via-white to-emerald-100 rounded-2xl p-4 sm:p-6 shadow-sm border border-emerald-100 space-y-4">
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
                  to={buildProductPath(product)}
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

        {/* 📦 TOUS LES PRODUITS AVEC PAGINATION */}
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Tous les Produits</h2>
              <p className="text-gray-500 text-xs">{items.length} produits disponibles</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-48"></div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {items.map((product, index) => (
                  <ProductCard key={`product-${product._id}-${index}`} p={product} />
                ))}
              </div>

              {/* PAGINATION MOBILE-FIRST */}
              {renderPagination()}
            </>
          ) : (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Aucun produit trouvé</h3>
              <p className="text-gray-500 text-sm mb-4">
                Modifiez vos critères de filtrage
              </p>
              <button
                onClick={() => {
                  setCategory("");
                  setSort("new");
                  setPage(1);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
