import React, { memo, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Star, Eye, ShoppingCart, MessageCircle, Zap, Clock, ShieldCheck, TrendingUp, Award, ChevronLeft, ChevronRight, Package, MapPin, Boxes } from 'lucide-react';
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
import { useAppSettings } from '../context/AppSettingsContext';

/**
 * 🎨 PRODUCT CARD PREMIUM HDMarket
 * Design aligné avec la page d'accueil premium
 * Éléments visuels modernes avec dégradés et SVG
 * Interactions utilisateur optimisées
 * Mobile-first et responsive
 */

function ProductCard({ p, hideMobileDiscountBadge = false, productLink, onProductClick, compactMobile = false }) {
  const { user } = useContext(AuthContext);
  const { formatPrice } = useAppSettings();
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
  const useCompactMobile = Boolean(compactMobile && isMobile);
  
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
  const mediaFrameClass = useCompactMobile
    ? `ui-media-frame relative overflow-hidden aspect-[4/3] ${hasMultipleImages ? 'touch-pan-y' : ''}`
    : `ui-media-frame ui-media-frame-square relative overflow-hidden ${hasMultipleImages ? 'touch-pan-y' : ''}`;

  // Preload only the first images so large grids stay responsive.
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

    const imagesToPreload = productImages.slice(0, 2);
    imagesToPreload.forEach((image, index) => {
      if (image && image !== 'https://via.placeholder.com/400x400') {
        preloadImage(image, index);
      } else {
        // Mark placeholder as loaded
        setImagesLoaded((prev) => {
          if (prev[index] === true) return prev;
          return { ...prev, [index]: true };
        });
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
  const promoPercent = Number(p?.promoPercent || 0);
  const hasActivePromo = Boolean(p?.hasActivePromo && promoPercent > 0);
  const hasActiveBoost = Boolean(p?.boosted || p?.isBoosted || p?.activeBoostRequestId);
  const promoPercentLabel = Math.max(1, Math.round(promoPercent));
  const promoScopeLabel = p?.promoScope === 'product' ? 'Produit' : 'Boutique';
  const installmentAvailable = useMemo(() => {
    if (p?.installmentAvailable) return true;
    if (!p?.installmentEnabled) return false;
    const start = p?.installmentStartDate ? new Date(p.installmentStartDate) : null;
    const end = p?.installmentEndDate ? new Date(p.installmentEndDate) : null;
    if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return false;
    const now = new Date();
    return now >= start && now <= end;
  }, [p]);
  const wholesaleEnabled = useMemo(() => {
    if (!p?.wholesaleEnabled) return false;
    if (!Array.isArray(p?.wholesaleTiers)) return false;
    return p.wholesaleTiers.some((tier) => Number(tier?.minQty || 0) > 0);
  }, [p?.wholesaleEnabled, p?.wholesaleTiers]);
  const wholesaleMinQty = useMemo(() => {
    if (!wholesaleEnabled) return null;
    const tiers = Array.isArray(p?.wholesaleTiers) ? p.wholesaleTiers : [];
    if (!tiers.length) return null;
    const minTierQty = tiers.reduce((min, tier) => {
      const qty = Number(tier?.minQty || 0);
      if (!Number.isFinite(qty) || qty <= 0) return min;
      if (min == null) return qty;
      return qty < min ? qty : min;
    }, null);
    return Number.isFinite(minTierQty) && minTierQty > 0 ? minTierQty : null;
  }, [p?.wholesaleTiers, wholesaleEnabled]);
  const pickupOnly = p?.deliveryAvailable === false && p?.pickupAvailable !== false;
  const freeDeliveryAvailable = Boolean(
    (p?.deliveryAvailable !== false && (p?.user?.freeDeliveryEnabled || p?.shopFreeDeliveryEnabled)) ||
      (p?.deliveryAvailable !== false &&
        (p?.deliveryFeeEnabled === false || Number(p?.deliveryFee || 0) <= 0))
  );
  const discountedPrice = formatPrice(hasDiscount ? p.priceAfterDiscount || p.price : p.price);
  const originalPrice = hasDiscount && p.priceBeforeDiscount
    ? formatPrice(p.priceBeforeDiscount)
    : null;
  
  const ratingAverage = Number(p.ratingAverage || 0).toFixed(1);
  const ratingCount = p.ratingCount || 0;
  const commentCount = p.commentCount || 0;
  const isShopVerified = Boolean(p.user?.shopVerified ?? p.shopVerified);
  const shopLogoSrc = p.user?.shopLogo || p.shopLogo || null;
  const productCity = useMemo(() => String(p?.user?.city || p?.city || '').trim(), [p?.user?.city, p?.city]);

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

  useEffect(() => {
    if (!p?.activeBoostRequestId) return;
    api.post('/boosts/track/impressions', { requestIds: [p.activeBoostRequestId] }).catch(() => {});
  }, [p?._id, p?.activeBoostRequestId]);

  const trackBoostClick = useCallback(() => {
    if (!p?.activeBoostRequestId) return;
    api.post(`/boosts/requests/${p.activeBoostRequestId}/click`).catch(() => {});
  }, [p?.activeBoostRequestId]);
  
  const conditionLabel = p?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionColor = p?.condition === 'new' 
    ? 'bg-neutral-900' 
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
      className="ui-card ui-card-interactive ui-hover-scale ui-card-fade-in group relative flex h-full w-full flex-col overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 🖼️ SECTION IMAGE AVEC CAROUSEL */}
      <Link
        to={resolvedProductLink}
        {...externalLinkProps}
        onClick={() => {
          trackBoostClick();
          handleProductClick?.(p);
        }}
        className={mediaFrameClass}
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
                      className="ui-media-img ui-media-img-contain"
                      style={{
                        opacity: 1,
                        visibility: 'visible',
                        display: 'block'
                      }}
                      onLoad={() => {
                        if (!isImageError) {
                          setImagesLoaded((prev) => {
                            if (prev[index] === true) return prev;
                            return { ...prev, [index]: true };
                          });
                        }
                        if (index === 0) setImageLoaded(true);
                      }}
                      onError={() => {
                        setImagesLoaded((prev) => {
                          if (prev[index] === false) return prev;
                          return { ...prev, [index]: false };
                        });
                        if (index === 0) setImageError(true);
                      }}
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
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
                      ? 'w-2 h-2 max-[375px]:w-1.5 max-[375px]:h-1.5 sm:w-2.5 sm:h-2.5 bg-white shadow-lg' 
                      : 'w-1.5 h-1.5 max-[375px]:w-1 max-[375px]:h-1 sm:w-2 sm:h-2 bg-white/60 hover:bg-white/80'
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
                className="absolute left-1 top-1/2 -translate-y-1/2 z-30 hidden h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all hover:scale-105 hover:bg-white sm:flex sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-3 w-3 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToNextImage();
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-30 hidden h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all hover:scale-105 hover:bg-white sm:flex sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="h-3 w-3 text-gray-700" />
              </button>
            </>
          </div>
        ) : (
          /* Single Image - No carousel */
          <div className="relative w-full h-full">
            <img
              src={imageError ? "https://via.placeholder.com/400x400?text=HDMarket" : productImages[0]}
              alt={p.title}
              className="ui-media-img ui-media-img-contain"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            
            {/* Skeleton loader */}
            {!imageLoaded && <div className="ui-skeleton absolute inset-0 z-10" />}
          </div>
        )}

        {/* 🔖 BADGES PROMOTIONNELS TAOBAO STYLE */}
        <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-20 flex flex-col gap-1 sm:gap-1.5">
          {/* Badge Promo code (boutique/produit) */}
          {hasActivePromo && (
            <div className="bg-black text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded sm:rounded-md text-[9px] sm:text-[10px] font-black shadow-lg border border-white/20">
              Promo {promoScopeLabel} -{promoPercentLabel}%
            </div>
          )}
          {hasActiveBoost && !useCompactMobile && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-white/95 text-neutral-900 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-semibold shadow-md">
              <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Boost
            </div>
          )}
          {/* Badge Promotion Principal */}
          {hasDiscount && (
            <div className="bg-neutral-900 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded sm:rounded-md text-[9px] sm:text-[10px] font-black shadow-lg border border-white/20">
              -{p.discount}%
            </div>
          )}
          
          {/* Badge 年货补贴周 Style */}
          {(hasDiscount || isNew) && !useCompactMobile && (
            <div className="bg-neutral-700 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              {isNew ? 'Nouveau' : 'Promo'}
            </div>
          )}

          {/* Badge Certifié */}
          {p.certified && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-neutral-900 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <ShieldCheck className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Certifié
            </div>
          )}
          {installmentAvailable && !useCompactMobile && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-neutral-800 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Paiement en tranche
            </div>
          )}
          {wholesaleEnabled && !useCompactMobile && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-emerald-700 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <Boxes className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Vente en gros{wholesaleMinQty ? ` dès ${wholesaleMinQty}` : ''}
            </div>
          )}
          {pickupOnly && !useCompactMobile && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-slate-700 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <Package className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Retrait boutique
            </div>
          )}
          {freeDeliveryAvailable && (
            <div className="inline-flex items-center gap-0.5 sm:gap-1 bg-neutral-900 text-white px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold shadow-md">
              <ShieldCheck className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Livraison gratuite
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
                ? 'text-neutral-700 dark:text-neutral-200 transform scale-110' 
                : 'text-gray-600 group-hover/fav:text-neutral-900 dark:group-hover/fav:text-neutral-100'
            }`}
            strokeWidth={2}
            fill={isInFavorites ? 'currentColor' : 'none'}
          />
        </button>

        {/* 📊 INDICATEURS DE VENTE TAOBAO STYLE */}
        {!useCompactMobile && (
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
                <div className="bg-neutral-700 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold">
                  Tendance {formatSalesCount(salesCount)}
                </div>
              )}

              {/* Badge Best Seller */}
              {isBestSeller && (
                <div className="bg-black text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 sm:gap-1">
                  <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  TOP VENTE
                </div>
              )}
            </div>
          </div>
        )}
      </Link>

      {/* 📦 INFOS PRODUIT TAOBAO STYLE */}
      <div
        className={`flex-1 flex flex-col min-h-0 ${
          useCompactMobile
            ? 'px-1.5 py-1.5 space-y-1'
            : 'px-2 sm:px-3 py-2 sm:py-3 space-y-1.5 sm:space-y-2'
        }`}
      >
        {/* Titre du produit */}
        <h3
          className={`font-bold text-gray-900 line-clamp-2 leading-tight ${
            useCompactMobile
              ? 'text-[11px] min-h-[1.5rem]'
              : 'text-xs sm:text-sm min-h-[2rem] sm:min-h-[2.5rem]'
          }`}
        >
          {p.title}
        </h3>

        {/* Prix avec réduction */}
        <div className={`flex items-baseline flex-wrap ${useCompactMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
          <span className={`${useCompactMobile ? 'text-[11px]' : 'text-base sm:text-lg'} font-black text-neutral-950 dark:text-white`}>
            {discountedPrice}
          </span>
          {originalPrice && (
            <span className="text-[10px] sm:text-xs text-gray-400 line-through">{originalPrice}</span>
          )}
          {hasDiscount && !useCompactMobile && (
            <span className="text-[9px] sm:text-[10px] font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-1 sm:px-1.5 py-0.5 rounded">
              Prix promo
            </span>
          )}
        </div>

        {/* Stats Row */}
        {!useCompactMobile && (
          <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] text-gray-500 flex-wrap">
            {ratingAverage > 0 && (
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-700 fill-neutral-700 dark:text-neutral-200 dark:fill-neutral-200" />
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
              <div className="flex items-center gap-0.5 sm:gap-1 text-neutral-700 dark:text-neutral-300">
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="font-semibold">
                  {hasRealSalesData ? 'Vendu' : 'Engagement'} {formatSalesCount(salesCount)}
                </span>
              </div>
            )}
          </div>
        )}

        {productCity && (
          <div
            className={`inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 ${
              useCompactMobile ? 'text-[8px]' : 'text-[9px]'
            }`}
          >
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{productCity}</span>
          </div>
        )}

        {installmentAvailable && !useCompactMobile && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[9px] font-semibold text-neutral-700 dark:text-neutral-200">
            Paiement en plusieurs fois disponible
          </div>
        )}
        {wholesaleEnabled && !useCompactMobile && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Boxes className="h-2.5 w-2.5" />
            Vente en gros disponible{wholesaleMinQty ? ` dès ${wholesaleMinQty} pièces` : ''}
          </div>
        )}
        {pickupOnly && !useCompactMobile && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-0.5 text-[9px] font-semibold text-neutral-700 dark:text-neutral-200">
            Retrait boutique uniquement
          </div>
        )}

        {/* Badges de fonctionnalités */}
        {p.certified && !useCompactMobile && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-2 py-0.5 rounded text-[9px] font-semibold border border-neutral-200 dark:border-neutral-700">
              <ShieldCheck className="w-2.5 h-2.5" />
              Garanti authentique
            </span>
            {conditionLabel === 'Neuf' && (
              <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-2 py-0.5 rounded text-[9px] font-semibold border border-neutral-200 dark:border-neutral-700">
                Neuf
              </span>
            )}
          </div>
        )}

        {/* Boutique info */}
        {isShopVerified && !useCompactMobile && (
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
              className="text-[10px] font-semibold text-[#8E8E93] truncate hover:text-neutral-700 dark:text-neutral-200"
            >
              {p.user?.shopName || 'Boutique HDMarket'}
            </Link>
            <VerifiedBadge verified showLabel={false} className="text-[8px]" />
          </div>
        )}

        {/* 🛒 BOUTON AJOUTER AU PANIER */}
        {!isOwner && (
          <div className={`${useCompactMobile ? 'pt-1.5' : 'pt-2'} border-t border-gray-100 dark:border-neutral-800`}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddToCart();
              }}
              disabled={adding || inCart}
              className={`w-full inline-flex items-center justify-center ${
                useCompactMobile
                  ? 'gap-1 px-2 py-1 rounded-xl text-[9px]'
                  : 'gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-3xl text-[10px] sm:text-xs'
              } font-semibold transition-all duration-200 active:scale-95 shadow-sm ${
                inCart
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed opacity-60'
                  : adding
                  ? 'bg-neutral-800 text-white cursor-wait'
                  : 'bg-black text-white hover:bg-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              }`}
            >
              <ShoppingCart size={12} className="sm:w-4 sm:h-4" />
              <span>
                {inCart ? 'Déjà au panier' : adding ? 'Ajout...' : useCompactMobile ? 'Panier' : 'Ajouter au panier'}
              </span>
            </button>
          </div>
        )}

        {/* Messages de feedback */}
        {feedback && (
          <p className="text-[10px] text-neutral-700 dark:text-neutral-200 font-semibold">{feedback}</p>
        )}
        {addError && (
          <p className="text-[10px] text-neutral-950 dark:text-white">{addError}</p>
        )}
      </div>
    </div>
  );
}

export default memo(ProductCard);
