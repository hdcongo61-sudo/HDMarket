import React, { useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Star, Eye, ShoppingCart, MessageCircle, Zap, Clock, ShieldCheck, TrendingUp, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import FavoriteContext from '../context/FavoriteContext';
import api from '../services/api';
import { buildWhatsappLink } from '../utils/whatsapp';
import { buildProductPath, buildShopPath } from '../utils/links';
import { recordProductView } from '../utils/recentViews';
import { setPendingAction } from '../utils/pendingAction';
import VerifiedBadge from './VerifiedBadge';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';

/**
 * 🎨 PRODUCT CARD PREMIUM HDMarket
 * Design aligné avec la page d'accueil premium
 * Éléments visuels modernes avec dégradés et SVG
 * Interactions utilisateur optimisées
 * Mobile-first et responsive
 */

export default function ProductCard({ p, hideMobileDiscountBadge = false, productLink, onProductClick }) {
  const { user } = useContext(AuthContext);
  const { addItem, cart } = useContext(CartContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [addError, setAddError] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const carouselIntervalRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState({});
  const isMobile = useIsMobile();
  
  const inCart = Boolean(user && cart?.items?.some((item) => item.product?._id === p._id));
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  const isInFavorites = isFavorite(p._id);
  const [whatsappClicks, setWhatsappClicks] = useState(p.whatsappClicks || 0);
  const [favoriteCount, setFavoriteCount] = useState(p.favoritesCount || 0);
  const externalLinkProps = useDesktopExternalLink();
  const resolvedProductLink = productLink || buildProductPath(p);
  const handleProductClick = onProductClick || recordProductView;

  // Get all product images
  const productImages = useMemo(() => {
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    return images.length > 0 ? images : ['https://via.placeholder.com/400x400'];
  }, [p.images]);

  const hasMultipleImages = productImages.length > 1;
  const shouldShowCarousel = hasMultipleImages; // Enable carousel for multiple images
  const shouldAutoCarousel = false; // Auto-carousel disabled - manual only

  // Preload ALL images immediately to prevent blank slides
  useEffect(() => {
    const preloadImage = (src, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed

      img.onload = () => {
        setImagesLoaded((prev) => {
          // Only update if not already loaded to prevent unnecessary re-renders
          if (prev[index] === true) return prev;
          return { ...prev, [index]: true };
        });
      };

      img.onerror = () => {
        setImagesLoaded((prev) => {
          if (prev[index] === false) return prev;
          return { ...prev, [index]: false };
        });
      };

      img.src = src;
    };

    // Preload ALL images when component mounts or images change
    // This runs for both single and multiple images to ensure immediate loading
    productImages.forEach((image, index) => {
      if (image && image !== 'https://via.placeholder.com/400x400') {
        preloadImage(image, index);
      } else {
        // Mark placeholder as loaded
        setImagesLoaded((prev) => ({ ...prev, [index]: true }));
      }
    });
  }, [productImages, p.title]);

  // Navigate to next/previous image
  const goToNextImage = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, productImages.length]);

  const goToPreviousImage = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, productImages.length]);

  // Auto carousel for multiple images (both mobile and desktop)
  useEffect(() => {
    if (!shouldAutoCarousel) return;
    
    carouselIntervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => {
        if (isTransitioning) return prev;
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 500);
        return (prev + 1) % productImages.length;
      });
    }, 4000); // Change image every 4 seconds

    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current);
      }
    };
  }, [shouldAutoCarousel, productImages.length, isTransitioning]);

  // Reset carousel on hover pause
  const handleMouseEnter = () => {
    if (carouselIntervalRef.current) {
      clearInterval(carouselIntervalRef.current);
    }
  };

  const handleMouseLeave = () => {
    if (shouldAutoCarousel && !isMobile) {
      carouselIntervalRef.current = setInterval(() => {
        setCurrentImageIndex((prev) => {
          if (isTransitioning) return prev;
          setIsTransitioning(true);
          setTimeout(() => setIsTransitioning(false), 500);
          return (prev + 1) % productImages.length;
        });
      }, 4000);
    }
  };

  // Touch handlers for swipe on mobile
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) {
        // Swipe left - next image
        goToNextImage();
      } else {
        // Swipe right - previous image
        goToPreviousImage();
      }
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };
  
  const whatsappLink = useMemo(
    () => buildWhatsappLink(p, p?.user?.phone || p?.contactPhone),
    [p]
  );
  // === EFFETS DE SYNCHRONISATION ===
  useEffect(() => {
    setWhatsappClicks(p.whatsappClicks || 0);
  }, [p._id, p.whatsappClicks]);

  useEffect(() => {
    setFavoriteCount(p.favoritesCount || 0);
  }, [p._id, p.favoritesCount]);

  // === LOGIQUE D'AUTHENTIFICATION ===
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const redirectToLogin = () => {
    navigate('/login', { state: { from: currentPath || '/' } });
  };
  
  const requireAuth = () => {
    if (!user) {
      redirectToLogin();
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!inCart) {
      setFeedback('');
    }
  }, [inCart]);

  // === CALCULS ET DÉRIVATIONS ===
  const hasDiscount = typeof p.discount === 'number' && p.discount > 0;
  const price = Number(p.price).toLocaleString();
  const originalPrice = hasDiscount && p.priceBeforeDiscount
    ? Number(p.priceBeforeDiscount).toLocaleString()
    : null;
  
  const ratingAverage = Number(p.ratingAverage || 0).toFixed(1);
  const ratingCount = p.ratingCount || 0;
  const commentCount = p.commentCount || 0;
  const isShopVerified = Boolean(p.user?.shopVerified ?? p.shopVerified);
  const shopLogoSrc = p.user?.shopLogo || p.shopLogo || null;

  // Calcul de la date de publication
  const { publishedLabel, daysSince, isNew } = useMemo(() => {
    if (!p?.createdAt) return { publishedLabel: '', daysSince: null, isNew: false };
    const created = new Date(p.createdAt);
    if (Number.isNaN(created.getTime())) return { publishedLabel: '', daysSince: null, isNew: false };
    
    const diffMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const isNewProduct = days <= 7; // Considéré comme nouveau pendant 7 jours
    
    if (days === 0) return { publishedLabel: "Aujourd'hui", daysSince: 0, isNew: isNewProduct };
    if (days === 1) return { publishedLabel: 'Hier', daysSince: 1, isNew: isNewProduct };
    
    return { 
      publishedLabel: `Il y a ${days}j`, 
      daysSince: days, 
      isNew: isNewProduct 
    };
  }, [p.createdAt]);

  const ownerId = p?.user?._id || p?.user;
  const isOwner = Boolean(user && ownerId && String(ownerId) === user.id);
  
  const conditionLabel = p?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionColor = p?.condition === 'new' 
    ? 'bg-emerald-600' 
    : 'bg-amber-600';

  // === GESTION DES INTERACTIONS ===
  const handleFavoriteToggle = async (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!user) {
      setPendingAction({ type: 'addFavorite', payload: { product: p } });
      redirectToLogin();
      return;
    }
    try {
      const result = await toggleFavorite(p);
      if (result === true) {
        setFavoriteCount((prev) => prev + 1);
      } else if (result === false) {
        setFavoriteCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Impossible de modifier les favoris.', error);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      setPendingAction({ type: 'addToCart', payload: { productId: p._id, quantity: 1 } });
      redirectToLogin();
      return;
    }
    if (inCart) return;
    setAdding(true);
    setAddError('');
    try {
      await addItem(p._id, 1);
      setFeedback('Ajouté au panier !');
    } catch (e) {
      setAddError(e.response?.data?.message || e.message || "Impossible d'ajouter cet article.");
    } finally {
      setAdding(false);
    }
  };

  const handleWhatsappClick = async (e) => {
    if (!requireAuth()) {
      e.preventDefault();
      return;
    }
    try {
      const target = p.slug || p._id;
      const { data } = await api.post(`/products/public/${target}/whatsapp-click`);
      setWhatsappClicks((prev) =>
        typeof data?.whatsappClicks === 'number' ? data.whatsappClicks : (prev || 0) + 1
      );
    } catch (error) {
      console.error('Impossible de comptabiliser le clic WhatsApp', error);
    }
  };

  // Calculate sales indicators - Use real sales data if available, otherwise estimate based on engagement
  const salesCount = useMemo(() => {
    // If product has a real salesCount field, use it
    if (typeof p.salesCount === 'number' && p.salesCount > 0) {
      return p.salesCount;
    }
    
    // Otherwise, estimate based on engagement metrics
    // This is an approximation, not real sales data
    const views = p.views || 0;
    const favorites = p.favoritesCount || 0;
    const comments = p.commentCount || 0;
    const whatsapp = whatsappClicks || 0;
    
    // More realistic estimation: lower conversion rates
    const estimatedSales = Math.floor(
      (views * 0.02) + // 2% view-to-sale conversion
      (favorites * 1.5) + // Favorites indicate interest
      (comments * 2) + // Comments show engagement
      (whatsapp * 0.8) // WhatsApp clicks are strong signals
    );
    
    return estimatedSales;
  }, [p.views, p.favoritesCount, p.commentCount, p.salesCount, whatsappClicks]);
  
  const hasRealSalesData = typeof p.salesCount === 'number' && p.salesCount > 0;

  const formatSalesCount = (count) => {
    if (count >= 10000) return `${(count / 1000).toFixed(0)}k+`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k+`;
    return `${count}`;
  };

  const isHotSale = salesCount >= 3000;
  const isBestSeller = salesCount >= 10000;

  return (
    <div 
      className="group relative flex h-full w-full flex-col bg-white overflow-hidden rounded-[16px] border border-[#E5E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 dark:bg-[#1C1C1E] dark:border-[#38383A]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 🖼️ SECTION IMAGE AVEC CAROUSEL */}
      <Link
        to={resolvedProductLink}
        {...externalLinkProps}
        onClick={() => handleProductClick?.(p)}
        className={`relative aspect-square bg-gray-100 overflow-hidden ${hasMultipleImages ? 'touch-pan-y' : ''}`}
        {...(hasMultipleImages && {
          onTouchStart: handleTouchStart,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd
        })}
      >
        {shouldShowCarousel ? (
          /* Image Carousel with smooth sliding - Only when multiple images */
          <div className="relative w-full h-full overflow-hidden">
            <div
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentImageIndex * 100}%)`,
                width: '100%',
                willChange: 'transform'
              }}
            >
              {productImages.map((image, index) => {
                const isImageError = imagesLoaded[index] === false;
                const imageSrc = isImageError ? "https://via.placeholder.com/400x400?text=HDMarket" : image;
                const isImageLoaded = imagesLoaded[index] === true;

                return (
                  <div
                    key={`${p._id}-img-${index}-${image}`}
                    className="relative w-full h-full flex-shrink-0"
                    style={{
                      minWidth: '100%',
                      width: '100%'
                    }}
                  >
                    {/* Show loading skeleton while image loads */}
                    {!isImageLoaded && !isImageError && (
                      <div className="absolute inset-0 bg-gray-200 animate-pulse z-10"></div>
                    )}

                    <img
                      src={imageSrc}
                      alt={`${p.title} - Image ${index + 1}`}
                      className="w-full h-full object-contain"
                      style={{
                        opacity: 1,
                        visibility: 'visible',
                        display: 'block'
                      }}
                      onLoad={() => {
                        setImagesLoaded((prev) => ({ ...prev, [index]: true }));
                        if (index === 0) setImageLoaded(true);
                      }}
                      onError={() => {
                        setImagesLoaded((prev) => ({ ...prev, [index]: false }));
                        if (index === 0) setImageError(true);
                      }}
                      loading="eager"
                      fetchpriority={index <= 1 ? "high" : "auto"}
                    />
                  </div>
                );
              })}
            </div>

            {/* Carousel Indicators - Only for multiple images */}
            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 z-30 bg-black/40 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              {productImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isTransitioning) {
                      setIsTransitioning(true);
                      setCurrentImageIndex(index);
                      setTimeout(() => setIsTransitioning(false), 500);
                    }
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    index === currentImageIndex 
                      ? 'w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white shadow-lg' 
                      : 'w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/60 hover:bg-white/80'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>

            {/* Navigation arrows (desktop only) */}
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToPreviousImage();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToNextImage();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
            </>
          </div>
        ) : (
          /* Single Image - No carousel */
          <div className="relative w-full h-full">
            <img
              src={imageError ? "https://via.placeholder.com/400x400?text=HDMarket" : productImages[0]}
              alt={p.title}
              className="w-full h-full object-contain"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="eager"
            />
            
            {/* Skeleton loader */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse z-10"></div>
            )}
          </div>
        )}

        {/* 🔖 BADGES PROMOTIONNELS TAOBAO STYLE */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex flex-col gap-1 sm:gap-1.5">
          {/* Badge Promotion Principal */}
          {hasDiscount && (
            <div className="bg-red-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded sm:rounded-md text-[9px] sm:text-[10px] font-black shadow-lg border border-white/20">
              -{p.discount}%
            </div>
          )}
          
          {/* Badge 年货补贴周 Style */}
          {(hasDiscount || isNew) && (
            <div className="bg-orange-600 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              {isNew ? 'Nouveau' : 'Promo'}
            </div>
          )}

          {/* Badge Certifié */}
          {p.certified && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-emerald-500 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <ShieldCheck className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Certifié
            </div>
          )}
        </div>

        {/* ❤️ BOUTON FAVORI */}
        <button
          type="button"
          onClick={(event) => handleFavoriteToggle(event)}
          className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-30 bg-white/95 backdrop-blur-sm min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 tap-feedback flex items-center justify-center group/fav"
          aria-label={isInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart
            size={14}
            className={`sm:w-4 sm:h-4 transition-all duration-300 ${
              isInFavorites 
                ? 'text-red-500 transform scale-110' 
                : 'text-gray-600 group-hover/fav:text-red-400'
            }`}
            strokeWidth={2}
            fill={isInFavorites ? 'currentColor' : 'none'}
          />
        </button>

        {/* 📊 INDICATEURS DE VENTE TAOBAO STYLE */}
        <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 right-1.5 sm:right-2 z-20">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            {/* Badge Vendu/Engagement */}
            {salesCount > 0 && (
              <div className="bg-black/70 backdrop-blur-sm text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold">
                {hasRealSalesData ? 'Vendu' : 'Engagement'} {formatSalesCount(salesCount)}
              </div>
            )}
            
            {/* Badge Hot Sale */}
            {isHotSale && (
              <div className="bg-orange-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold">
                Tendance {formatSalesCount(salesCount)}
              </div>
            )}

            {/* Badge Best Seller */}
            {isBestSeller && (
              <div className="bg-purple-600 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 sm:gap-1">
                <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                TOP VENTE
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* 📦 INFOS PRODUIT TAOBAO STYLE */}
      <div className="flex-1 flex flex-col px-2 sm:px-3 py-2 sm:py-3 space-y-1.5 sm:space-y-2 min-h-0">
        {/* Titre du produit */}
        <h3 className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-2 leading-tight min-h-[2rem] sm:min-h-[2.5rem]">
          {p.title}
        </h3>

        {/* Prix avec réduction */}
        <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
          <div className="flex items-baseline gap-0.5 sm:gap-1">
            <span className="text-[10px] sm:text-xs text-gray-500">FCFA</span>
            <span className="text-base sm:text-lg font-black text-red-600">
              {hasDiscount ? Number(p.priceAfterDiscount || p.price).toLocaleString() : Number(p.price).toLocaleString()}
            </span>
          </div>
          {originalPrice && (
            <span className="text-[10px] sm:text-xs text-gray-400 line-through">
              {originalPrice} FCFA
            </span>
          )}
          {hasDiscount && (
            <span className="text-[9px] sm:text-[10px] font-bold text-red-500 bg-red-50 px-1 sm:px-1.5 py-0.5 rounded">
              Prix promo
            </span>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-gray-500 flex-wrap">
          {ratingAverage > 0 && (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-gray-700">{ratingAverage}</span>
              {ratingCount > 0 && (
                <span className="text-gray-500 hidden sm:inline">({formatSalesCount(ratingCount)})</span>
              )}
            </div>
          )}
          {commentCount > 0 && (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <MessageCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span>{formatSalesCount(commentCount)}</span>
            </div>
          )}
          {salesCount > 0 && (
            <div className="flex items-center gap-0.5 sm:gap-1 text-orange-600">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="font-semibold">
                {hasRealSalesData ? 'Vendu' : 'Engagement'} {formatSalesCount(salesCount)}
              </span>
            </div>
          )}
        </div>

        {/* Badges de fonctionnalités */}
        {p.certified && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-semibold border border-emerald-200">
              <ShieldCheck className="w-2.5 h-2.5" />
              Garanti authentique
            </span>
            {conditionLabel === 'Neuf' && (
              <span className="bg-[rgba(0,122,255,0.12)] text-[#007AFF] px-2 py-0.5 rounded text-[9px] font-semibold border border-[rgba(0,122,255,0.24)]">
                Neuf
              </span>
            )}
          </div>
        )}

        {/* Boutique info */}
        {isShopVerified && (
          <div className="flex items-center gap-1.5 pt-1">
            {shopLogoSrc && (
              <img
                src={shopLogoSrc}
                alt={p.user?.shopName || 'Logo boutique'}
                className="h-4 w-4 rounded-full border border-gray-200 object-cover"
                loading="lazy"
              />
            )}
            <Link
              to={buildShopPath(p.user)}
              {...externalLinkProps}
              className="text-[10px] font-semibold text-[#8E8E93] truncate hover:text-[#007AFF]"
            >
              {p.user?.shopName || 'Boutique HDMarket'}
            </Link>
            <VerifiedBadge verified showLabel={false} className="text-[8px]" />
          </div>
        )}

        {/* 🛒 BOUTON AJOUTER AU PANIER */}
        {!isOwner && (
          <div className="pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToCart();
              }}
              disabled={adding || inCart}
              className={`w-full inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-3xl text-[10px] sm:text-xs font-semibold transition-all duration-200 active:scale-95 shadow-sm ${
                inCart
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-60'
                  : adding
                  ? 'bg-[#007AFF]/80 text-white cursor-wait'
                  : 'bg-[#007AFF] text-white hover:bg-[#0051D5] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              }`}
            >
              <ShoppingCart size={12} className="sm:w-4 sm:h-4" />
              <span>
                {inCart ? 'Déjà au panier' : adding ? 'Ajout...' : 'Ajouter au panier'}
              </span>
            </button>
          </div>
        )}

        {/* Messages de feedback */}
        {feedback && (
          <p className="text-[10px] text-emerald-600 font-semibold">{feedback}</p>
        )}
        {addError && (
          <p className="text-[10px] text-red-600">{addError}</p>
        )}
      </div>
    </div>
  );
}
