import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, Images } from 'lucide-react';
import { getProductCardImageUrl, getProductCardSrcSet } from '../../utils/productImageUrl';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x400?text=HDMarket';
const SWIPE_HINT_STORAGE_KEY = 'hd_product_card_swipe_hint_completed_v1';
let swipeHintClaimed = false;

const canClaimSwipeHint = () => {
  if (swipeHintClaimed || typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(SWIPE_HINT_STORAGE_KEY) === '1') return false;
  } catch {
    // The hint still works for this session when storage is unavailable.
  }
  swipeHintClaimed = true;
  return true;
};

const markSwipeHintCompleted = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SWIPE_HINT_STORAGE_KEY, '1');
  } catch {
    // Private browsing can reject storage; the module guard still prevents duplicates.
  }
};

const getFinePointer = () => (
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches
);

const getReducedMotion = () => (
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

function ProductCardGallery({
  images,
  title,
  currentIndex,
  onIndexChange,
  onOpenPreview,
  onAnalytics,
  config,
  imageWidth = 640,
  lite = false,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  reserveBottomSpace = false,
  compact = false
}) {
  const galleryRef = useRef(null);
  const pointerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const autoPreviewTimerRef = useRef(null);
  const autoReturnTimerRef = useRef(null);
  const exposureTrackedRef = useRef(false);
  const autoPreviewDoneRef = useRef(false);
  const interactedRef = useRef(false);
  const viewedIndexesRef = useRef(new Set([0]));
  const sessionStartedAtRef = useRef(Date.now());
  const currentIndexRef = useRef(currentIndex);
  const suppressClickRef = useRef(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loadableIndexes, setLoadableIndexes] = useState(() => new Set());
  const [imageStatus, setImageStatus] = useState({});
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [thumbnailsPinned, setThumbnailsPinned] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(() => (
    Boolean(config?.enabled && config?.enableCarousel && config?.enableSwipe) && canClaimSwipeHint()
  ));

  const safeImages = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  );
  const firstImage = safeImages[0] || '';
  const imageCount = safeImages.length;
  const mode = config?.enableCarousel ? config.defaultDisplayMode : 'stacked';
  const carouselActive = Boolean(
    config?.enabled && config?.enableCarousel && config?.enableSwipe && mode === 'swipe'
  );
  const thumbnailPreviewEnabled = Boolean(config?.enabled && config?.enableThumbnailPreview);
  const animationSpeedMs = Number(config?.animationSpeedMs || 360);
  const maxPreload = Number(config?.maxImagesToPreload || 0);
  const reducedMotion = getReducedMotion();
  currentIndexRef.current = currentIndex;

  const optimizedImages = useMemo(() => safeImages.map((image) => ({
    source: image,
    src: getProductCardImageUrl(image, { width: imageWidth, lite }),
    srcSet: getProductCardSrcSet(image, { lite }),
    thumbnail: getProductCardImageUrl(image, { width: 112, lite: true })
  })), [imageWidth, lite, safeImages]);

  const clearInteractionTimers = useCallback(() => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    longPressTimerRef.current = null;
    hoverTimerRef.current = null;
  }, []);

  const clearAutoPreviewTimers = useCallback(() => {
    if (autoPreviewTimerRef.current) window.clearTimeout(autoPreviewTimerRef.current);
    if (autoReturnTimerRef.current) window.clearTimeout(autoReturnTimerRef.current);
    autoPreviewTimerRef.current = null;
    autoReturnTimerRef.current = null;
  }, []);

  const dismissSwipeHint = useCallback((persist = true) => {
    setShowSwipeHint(false);
    if (persist) markSwipeHintCompleted();
  }, []);

  const markInteraction = useCallback(() => {
    interactedRef.current = true;
    dismissSwipeHint(true);
    clearAutoPreviewTimers();
  }, [clearAutoPreviewTimers, dismissSwipeHint]);

  const selectImage = useCallback((nextIndex, source = 'control') => {
    const boundedIndex = Math.max(0, Math.min(Number(nextIndex) || 0, imageCount - 1));
    if (boundedIndex === currentIndexRef.current) return false;
    currentIndexRef.current = boundedIndex;
    viewedIndexesRef.current.add(boundedIndex);
    onIndexChange?.(boundedIndex);
    onAnalytics?.('image_view', {
      image_index: boundedIndex + 1,
      image_count: imageCount,
      source,
      unique_images_viewed: viewedIndexesRef.current.size
    });
    if (boundedIndex === imageCount - 1) {
      onAnalytics?.('completion', {
        image_count: imageCount,
        unique_images_viewed: viewedIndexesRef.current.size,
        completion_rate: 1
      });
    }
    return true;
  }, [imageCount, onAnalytics, onIndexChange]);

  const goPrevious = useCallback((source = 'arrow') => {
    markInteraction();
    return selectImage(currentIndex - 1, source);
  }, [currentIndex, markInteraction, selectImage]);

  const goNext = useCallback((source = 'arrow') => {
    markInteraction();
    return selectImage(currentIndex + 1, source);
  }, [currentIndex, markInteraction, selectImage]);

  useEffect(() => {
    viewedIndexesRef.current = new Set([0]);
    sessionStartedAtRef.current = Date.now();
    exposureTrackedRef.current = false;
    autoPreviewDoneRef.current = false;
    interactedRef.current = false;
    setImageStatus({});
    setLoadableIndexes(new Set());
  }, [firstImage]);

  useEffect(() => {
    const node = galleryRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      setVisible(true);
      return undefined;
    }

    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        preloadObserver.disconnect();
      },
      { rootMargin: `${Number(config?.lazyLoadDistancePx || 0)}px` }
    );
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.35)),
      { threshold: [0, 0.35, 0.7] }
    );
    preloadObserver.observe(node);
    visibilityObserver.observe(node);
    return () => {
      preloadObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [config?.lazyLoadDistancePx]);

  useEffect(() => {
    if (!nearViewport || imageCount === 0) return;
    setLoadableIndexes((previous) => {
      const next = new Set(previous);
      next.add(currentIndex);
      for (let offset = 1; offset <= maxPreload; offset += 1) {
        if (currentIndex + offset < imageCount) next.add(currentIndex + offset);
      }
      return next;
    });
  }, [currentIndex, imageCount, maxPreload, nearViewport]);

  useEffect(() => {
    if (!visible || exposureTrackedRef.current) return;
    exposureTrackedRef.current = true;
    onAnalytics?.('exposure', {
      image_count: imageCount,
      mode,
      swipe_enabled: carouselActive
    });
  }, [carouselActive, imageCount, mode, onAnalytics, visible]);

  useEffect(() => {
    if (
      !config?.enableAutoPreview ||
      !carouselActive ||
      !visible ||
      hovering ||
      dragging ||
      imageCount < 2 ||
      autoPreviewDoneRef.current ||
      interactedRef.current ||
      reducedMotion
    ) return undefined;

    autoPreviewTimerRef.current = window.setTimeout(() => {
      if (interactedRef.current) return;
      autoPreviewDoneRef.current = true;
      selectImage(1, 'auto_preview');
      autoReturnTimerRef.current = window.setTimeout(() => {
        if (!interactedRef.current) selectImage(0, 'auto_return');
      }, Math.max(1200, animationSpeedMs + 900));
    }, 2000);

    return () => {
      if (autoPreviewTimerRef.current) window.clearTimeout(autoPreviewTimerRef.current);
      autoPreviewTimerRef.current = null;
    };
  }, [
    animationSpeedMs,
    carouselActive,
    config?.enableAutoPreview,
    dragging,
    hovering,
    imageCount,
    reducedMotion,
    selectImage,
    visible
  ]);

  useEffect(() => {
    if (!showSwipeHint || !visible) return undefined;
    const timer = window.setTimeout(() => setShowSwipeHint(false), 4800);
    return () => window.clearTimeout(timer);
  }, [showSwipeHint, visible]);

  useEffect(() => () => {
    clearInteractionTimers();
    clearAutoPreviewTimers();
    if (interactedRef.current) {
      onAnalytics?.('session', {
        image_count: imageCount,
        unique_images_viewed: viewedIndexesRef.current.size,
        average_images_viewed: viewedIndexesRef.current.size,
        completion_rate: viewedIndexesRef.current.has(imageCount - 1) ? 1 : 0,
        duration_ms: Date.now() - sessionStartedAtRef.current
      });
    }
  }, [clearAutoPreviewTimers, clearInteractionTimers, imageCount, onAnalytics]);

  const handlePointerDown = (event) => {
    if (event.target?.closest?.('button')) return;
    dismissSwipeHint(true);
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      axis: 'pending'
    };
    if (carouselActive) event.currentTarget.setPointerCapture?.(event.pointerId);
    if (thumbnailPreviewEnabled && event.pointerType !== 'mouse') {
      longPressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = true;
        interactedRef.current = true;
        setThumbnailsPinned(true);
        setShowThumbnails(true);
        onAnalytics?.('thumbnail_open', { source: 'long_press', image_count: imageCount });
        navigator.vibrate?.(10);
      }, 430);
    }
  };

  const handlePointerMove = (event) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    if (pointer.axis === 'pending' && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      pointer.axis = carouselActive && Math.abs(deltaX) > Math.abs(deltaY) * 1.15
        ? 'horizontal'
        : 'vertical';
      if (pointer.axis !== 'pending') clearInteractionTimers();
    }
    if (pointer.axis !== 'horizontal') return;
    event.preventDefault();
    setDragging(true);
    const atFirstEdge = currentIndex === 0 && deltaX > 0;
    const atLastEdge = currentIndex === imageCount - 1 && deltaX < 0;
    setDragOffset((atFirstEdge || atLastEdge) ? deltaX * 0.24 : deltaX);
  };

  const finishPointer = (event, cancelled = false) => {
    clearInteractionTimers();
    const pointer = pointerRef.current;
    pointerRef.current = null;
    if (!pointer || pointer.id !== event.pointerId) {
      setDragging(false);
      setDragOffset(0);
      return;
    }
    if (pointer.axis === 'horizontal' && !cancelled) {
      const deltaX = event.clientX - pointer.x;
      const elapsedMs = Math.max(1, performance.now() - pointer.at);
      const velocity = Math.abs(deltaX) / elapsedMs;
      const shouldMove = Math.abs(deltaX) >= 44 || (Math.abs(deltaX) >= 24 && velocity > 0.35);
      if (shouldMove) {
        suppressClickRef.current = true;
        const direction = deltaX < 0 ? 'next' : 'previous';
        const changed = direction === 'next' ? goNext('swipe') : goPrevious('swipe');
        if (changed) {
          onAnalytics?.('swipe', {
            direction,
            from_image: currentIndex + 1,
            to_image: currentIndex + (direction === 'next' ? 2 : 0),
            image_count: imageCount
          });
        }
      }
    }
    setDragging(false);
    setDragOffset(0);
  };

  const handlePointerEnter = (event) => {
    setHovering(true);
    if (!thumbnailPreviewEnabled || event.pointerType !== 'mouse' || !getFinePointer()) return;
    hoverTimerRef.current = window.setTimeout(() => {
      setShowThumbnails(true);
      onAnalytics?.('thumbnail_open', { source: 'hover', image_count: imageCount });
    }, 320);
  };

  const handlePointerLeave = () => {
    setHovering(false);
    clearInteractionTimers();
    if (!thumbnailsPinned) setShowThumbnails(false);
    if (pointerRef.current) {
      pointerRef.current = null;
      setDragging(false);
      setDragOffset(0);
    }
  };

  const handleClickCapture = (event) => {
    dismissSwipeHint(true);
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleKeyDown = (event) => {
    if (!carouselActive) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious('keyboard');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext('keyboard');
    } else if (event.key === 'Home') {
      event.preventDefault();
      markInteraction();
      selectImage(0, 'keyboard');
    } else if (event.key === 'End') {
      event.preventDefault();
      markInteraction();
      selectImage(imageCount - 1, 'keyboard');
    }
  };

  const renderImage = (image, index, imageClassName = '') => {
    const canLoad = loadableIndexes.has(index);
    const failed = imageStatus[index] === 'error';
    const loaded = imageStatus[index] === 'loaded';
    return (
      <div className="relative h-full w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        {canLoad ? (
          <img
            src={failed ? PLACEHOLDER_IMAGE : image.src}
            srcSet={failed ? undefined : image.srcSet}
            alt={`${title} — photo ${index + 1} sur ${imageCount}`}
            className={`h-full w-full select-none object-cover transition-[filter,opacity,transform] duration-500 group-hover:scale-[1.02] ${loaded || failed ? 'blur-0 opacity-100' : 'scale-[1.04] blur-md opacity-60'} ${imageClassName}`}
            onLoad={() => setImageStatus((previous) => ({ ...previous, [index]: 'loaded' }))}
            onError={() => setImageStatus((previous) => ({ ...previous, [index]: 'error' }))}
            loading={index === currentIndex ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={index === currentIndex ? 'auto' : 'low'}
            draggable="false"
            sizes={sizes}
          />
        ) : null}
        {!loaded && !failed ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800" />
        ) : null}
      </div>
    );
  };

  if (imageCount < 2) return null;

  const indicatorPosition = compact ? 'right-11 top-1.5' : 'right-14 top-2';
  const dotsPosition = reserveBottomSpace ? 'bottom-10' : 'bottom-2';
  const trackTransform = `translate3d(calc(-${currentIndex * 100}% + ${dragOffset}px), 0, 0)`;

  return (
    <div
      ref={galleryRef}
      className={`relative h-full w-full overflow-hidden ${carouselActive ? 'touch-pan-y cursor-grab active:cursor-grabbing' : ''}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={`Galerie de ${imageCount} photos pour ${title}`}
      tabIndex={carouselActive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClickCapture={handleClickCapture}
      onContextMenu={(event) => {
        if (thumbnailsPinned) event.preventDefault();
      }}
    >
      {carouselActive ? (
        <div
          className="flex h-full will-change-transform motion-reduce:transition-none"
          style={{
            transform: trackTransform,
            transitionProperty: 'transform',
            transitionDuration: dragging || reducedMotion ? '0ms' : `${animationSpeedMs}ms`,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        >
          {optimizedImages.map((image, index) => (
            <div key={`${image.source}-${index}`} className="h-full min-w-full">
              {renderImage(image, index)}
            </div>
          ))}
        </div>
      ) : renderImage(optimizedImages[currentIndex] || optimizedImages[0], currentIndex)}

      {config?.enableCounter && carouselActive ? (
        <span className={`absolute z-20 inline-flex min-h-7 items-center rounded-full border border-white/15 bg-black/60 px-2.5 text-[10px] font-black tabular-nums text-white shadow-sm backdrop-blur-md ${indicatorPosition}`}>
          {currentIndex + 1} / {imageCount}
        </span>
      ) : null}

      {!carouselActive ? (
        <span className={`absolute z-20 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 text-[10px] font-black text-white shadow-sm backdrop-blur-md ${indicatorPosition}`}>
          <Images className="h-3.5 w-3.5" aria-hidden="true" />
          {mode === 'stacked' ? `+${imageCount - 1}` : imageCount}
        </span>
      ) : null}

      {carouselActive && !showThumbnails ? (
        <div className={`absolute left-1/2 z-20 flex max-w-[68%] -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm ${dotsPosition}`}>
          {safeImages.map((_, index) => (
            <button
              key={`gallery-dot-${index}`}
              type="button"
              className={`h-1.5 rounded-full transition-all duration-200 ${currentIndex === index ? 'w-4 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80'}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                markInteraction();
                selectImage(index, 'pagination');
              }}
              aria-label={`Afficher la photo ${index + 1} sur ${imageCount}`}
              aria-current={currentIndex === index ? 'true' : undefined}
            />
          ))}
        </div>
      ) : null}

      {carouselActive ? (
        <>
          <button
            type="button"
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-neutral-900 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:flex"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goPrevious('arrow');
            }}
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={currentIndex === imageCount - 1}
            className="absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-neutral-900 shadow-md backdrop-blur transition hover:scale-105 hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:flex"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goNext('arrow');
            }}
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}

      {showSwipeHint && carouselActive ? (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 z-30 flex -translate-y-1/2 justify-center">
          <span className="hd-gallery-swipe-hint inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
            <ChevronLeft className="h-3.5 w-3.5" />
            Glissez pour voir plus de photos
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : null}

      {showThumbnails && thumbnailPreviewEnabled ? (
        <div
          className="absolute inset-x-2 bottom-2 z-40 flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/25 bg-black/70 p-1.5 shadow-xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {optimizedImages.map((image, index) => (
            <button
              key={`gallery-thumbnail-${image.source}-${index}`}
              type="button"
              className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border-2 transition ${currentIndex === index ? 'border-white shadow-md' : 'border-transparent opacity-75 hover:opacity-100'}`}
              onClick={() => {
                markInteraction();
                setLoadableIndexes((previous) => new Set(previous).add(index));
                selectImage(index, 'thumbnail');
                onAnalytics?.('thumbnail_select', { image_index: index + 1, image_count: imageCount });
              }}
              aria-label={`Voir la photo ${index + 1}`}
              aria-current={currentIndex === index ? 'true' : undefined}
            >
              <img src={image.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
          <button
            type="button"
            className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-neutral-900 shadow-sm transition hover:scale-105"
            onClick={() => {
              markInteraction();
              onOpenPreview?.(currentIndex);
            }}
            aria-label="Agrandir la galerie"
          >
            <Expand className="h-4 w-4" />
          </button>
          {thumbnailsPinned ? (
            <button
              type="button"
              className="grid h-11 shrink-0 place-items-center rounded-xl bg-white/15 px-2 text-[10px] font-bold text-white"
              onClick={() => {
                setThumbnailsPinned(false);
                setShowThumbnails(false);
              }}
              aria-label="Fermer les miniatures"
            >
              Fermer
            </button>
          ) : null}
        </div>
      ) : null}

      <span className="sr-only" aria-live="polite">
        Photo {currentIndex + 1} sur {imageCount}
      </span>
    </div>
  );
}

export default memo(ProductCardGallery);
