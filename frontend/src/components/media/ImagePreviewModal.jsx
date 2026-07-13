import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Flag,
  Heart,
  MoreHorizontal,
  Share2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import BaseModal from '../modals/BaseModal';
import { useToast } from '../../context/ToastContext';
import AuthContext from '../../context/AuthContext';
import FavoriteContext from '../../context/FavoriteContext';
import api from '../../services/api';
import { trackEvent, trackRealtimeMonitoringEvent } from '../../services/analytics';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const injectCloudinaryTransform = (url = '', transform = '') => {
  if (!isCloudinaryUrl(url) || !transform) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
};

const toLowQualityUrl = (url = '') => injectCloudinaryTransform(url, 'f_auto,q_auto:eco,w_1400');
const toHighQualityUrl = (url = '') => injectCloudinaryTransform(url, 'f_auto,q_auto:best');

const toSafeString = (value = '', max = 500) => String(value || '').trim().slice(0, max);

const REPORT_REASON_OPTIONS = [
  { value: 'other', label: 'Autre' },
  { value: 'fraud', label: 'Fraude / trompeur' },
  { value: 'copyright', label: "Droit d'auteur" },
  { value: 'adult', label: 'Contenu adulte' },
  { value: 'violent', label: 'Contenu violent' },
  { value: 'spam', label: 'Spam' }
];

const sendPreviewAnalytics = (eventType, context = {}, extra = {}) => {
  const normalizedType = toSafeString(eventType, 80).toLowerCase();
  if (!normalizedType) return;
  const path =
    typeof window !== 'undefined'
      ? `${window.location.pathname || '/'}${window.location.search || ''}`
      : '/';
  const entityType =
    context?.contextType === 'shop' ? 'shop' : context?.contextType === 'product' ? 'product' : 'media';
  const entityId = context?.contextType === 'shop' ? context?.shopId : context?.productId;

  trackRealtimeMonitoringEvent({
    eventType: normalizedType,
    path,
    entityType,
    entityId: toSafeString(entityId, 80)
  });
  trackEvent(normalizedType, {
    entity_type: entityType,
    entity_id: toSafeString(entityId, 80),
    context_type: toSafeString(context?.contextType, 20),
    ...extra
  });
};

export default function ImagePreviewModal({
  isOpen,
  onClose,
  images = [],
  highResImages = [],
  initialIndex = 0,
  title = '',
  onReport,
  reportContext = null,
  product = null
}) {
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const { user } = useContext(AuthContext) || {};
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext) || {};
  const [favoritePending, setFavoritePending] = useState(false);
  const [heartPulse, setHeartPulse] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [hdImageErrors, setHdImageErrors] = useState({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('other');
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState('');
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startScale: 1
  });
  const panRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTranslateX: 0,
    startTranslateY: 0
  });
  const tapRef = useRef({ lastAt: 0 });
  const hasTrackedZoomRef = useRef(false);

  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const safeHighResInput = useMemo(
    () => (Array.isArray(highResImages) ? highResImages.filter(Boolean) : []),
    [highResImages]
  );
  const lowQualityImages = useMemo(() => safeImages.map((src) => toLowQualityUrl(src)), [safeImages]);
  const autoHighQualityImages = useMemo(() => safeImages.map((src) => toHighQualityUrl(src)), [safeImages]);
  const resolvedHighQualityImages = useMemo(() => {
    if (safeHighResInput.length === safeImages.length) {
      return safeHighResInput.map((src, index) => src || autoHighQualityImages[index] || safeImages[index] || '');
    }
    return autoHighQualityImages;
  }, [safeHighResInput, safeImages, autoHighQualityImages]);
  const canNavigate = safeImages.length > 1;

  // The quick-look can favorite the product it previews. Callers may pass the
  // full product; otherwise fall back to the report context (Home/shop grids
  // already provide productId/title/slug there).
  const favoriteProduct = useMemo(() => {
    if (product?._id) return product;
    if (reportContext?.contextType !== 'product' || !reportContext?.productId) return null;
    return {
      _id: reportContext.productId,
      title: reportContext.productTitle || title || 'Produit',
      slug: reportContext.productSlug || '',
      images: safeImages
    };
  }, [product, reportContext, title, safeImages]);
  const favoriteActive = Boolean(
    favoriteProduct && typeof isFavorite === 'function' && isFavorite(favoriteProduct._id)
  );

  const handleFavoriteToggle = useCallback(async () => {
    if (!favoriteProduct || typeof toggleFavorite !== 'function' || favoritePending) return;
    if (!user) {
      showToast('Connectez-vous pour enregistrer vos favoris.', { variant: 'error' });
      return;
    }
    setFavoritePending(true);
    setHeartPulse((pulse) => pulse + 1);
    try {
      const added = await toggleFavorite(favoriteProduct);
      sendPreviewAnalytics(
        added ? 'image_preview_favorite_add' : 'image_preview_favorite_remove',
        reportContext
      );
    } catch {
      showToast('Impossible de mettre à jour vos favoris.', { variant: 'error' });
    } finally {
      setFavoritePending(false);
    }
  }, [favoriteProduct, toggleFavorite, favoritePending, user, showToast, reportContext]);
  const canNativeReport = useMemo(() => {
    if (typeof onReport === 'function') return true;
    const contextType = reportContext?.contextType === 'shop' ? 'shop' : 'product';
    if (contextType === 'shop') return Boolean(toSafeString(reportContext?.shopId, 64));
    return Boolean(toSafeString(reportContext?.productId, 64));
  }, [onReport, reportContext]);

  const currentLowQuality = lowQualityImages[currentIndex] || safeImages[currentIndex] || '';
  const currentHighQuality =
    resolvedHighQualityImages[currentIndex] || safeImages[currentIndex] || currentLowQuality;
  const shouldUseHighQuality = Boolean(hdEnabled && !hdImageErrors[currentIndex] && currentHighQuality);
  const currentImage = shouldUseHighQuality ? currentHighQuality : currentLowQuality || currentHighQuality;

  const resetTransform = useCallback((options = {}) => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    if (!options.keepHd) setHdEnabled(false);
  }, []);

  const markZoomUsed = useCallback(() => {
    if (hasTrackedZoomRef.current) return;
    hasTrackedZoomRef.current = true;
    sendPreviewAnalytics('image_preview_zoom', reportContext, { source: 'gesture' });
  }, [reportContext]);

  const applyScale = useCallback(
    (nextScale) => {
      const boundedScale = clamp(Number(nextScale || 1), ZOOM_MIN, ZOOM_MAX);
      setScale(boundedScale);
      if (boundedScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      } else {
        setHdEnabled(true);
        markZoomUsed();
      }
    },
    [markZoomUsed]
  );

  useEffect(() => {
    if (!isOpen) return;
    setCurrentIndex(clamp(Number(initialIndex) || 0, 0, Math.max(0, safeImages.length - 1)));
    resetTransform();
    setMenuOpen(false);
    setReportOpen(false);
    setReportError('');
    hasTrackedZoomRef.current = false;
    sendPreviewAnalytics('image_preview_open', reportContext, {
      index: Number(initialIndex || 0)
    });
  }, [isOpen, initialIndex, resetTransform, safeImages.length, reportContext]);

  useEffect(() => {
    if (!isOpen || !safeImages.length) return;
    const preloadImages = hdEnabled ? resolvedHighQualityImages : lowQualityImages;
    const len = preloadImages.length;
    if (len < 2) return;
    const ids = [(currentIndex + 1) % len, (currentIndex - 1 + len) % len];
    ids.forEach((index) => {
      const src = preloadImages[index] || safeImages[index] || '';
      if (!src) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });
  }, [isOpen, safeImages, currentIndex, hdEnabled, lowQualityImages, resolvedHighQualityImages]);

  const moveIndex = useCallback(
    (direction) => {
      if (!canNavigate) return;
      setCurrentIndex((prev) => {
        const len = safeImages.length;
        if (!len) return 0;
        if (direction > 0) return (prev + 1) % len;
        return (prev - 1 + len) % len;
      });
      resetTransform();
      setMenuOpen(false);
    },
    [canNavigate, safeImages.length, resetTransform]
  );

  const handleShare = useCallback(async () => {
    if (!currentImage) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Image', url: currentImage });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentImage);
        showToast('Lien image copié.', { variant: 'success' });
      }
      sendPreviewAnalytics('image_preview_share', reportContext, { index: currentIndex });
    } catch {
      showToast('Partage non disponible.', { variant: 'info' });
    } finally {
      setMenuOpen(false);
    }
  }, [currentImage, showToast, title, reportContext, currentIndex]);

  const handleDownload = useCallback(() => {
    if (!currentImage) return;
    try {
      const anchor = document.createElement('a');
      anchor.href = currentImage;
      anchor.download = `hdmarket-image-${currentIndex + 1}.jpg`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      sendPreviewAnalytics('image_preview_download', reportContext, { index: currentIndex });
    } catch {
      showToast('Téléchargement indisponible.', { variant: 'error' });
    } finally {
      setMenuOpen(false);
    }
  }, [currentImage, currentIndex, showToast, reportContext]);

  const handleReportMenuAction = useCallback(() => {
    setMenuOpen(false);
    if (!canNativeReport) {
      showToast('Signalement indisponible sur ce contenu.', { variant: 'info' });
      return;
    }
    if (typeof onReport === 'function' && currentImage) {
      onReport(currentImage, currentIndex, reportContext);
      return;
    }
    setReportOpen(true);
  }, [canNativeReport, onReport, currentImage, currentIndex, reportContext, showToast]);

  const handleReportSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      const contextType = reportContext?.contextType === 'shop' ? 'shop' : 'product';
      const productId = toSafeString(reportContext?.productId, 64);
      const shopId = toSafeString(reportContext?.shopId, 64);
      if (contextType === 'product' && !productId) {
        setReportError('Contexte produit manquant pour ce signalement.');
        return;
      }
      if (contextType === 'shop' && !shopId) {
        setReportError('Contexte boutique manquant pour ce signalement.');
        return;
      }

      setReporting(true);
      setReportError('');
      try {
        await api.post('/users/reports/preview-image', {
          imageUrl: safeImages[currentIndex] || currentImage,
          contextType,
          productId: productId || null,
          shopId: shopId || null,
          reasonCategory: reportCategory,
          reason: toSafeString(reportReason, 500),
          imageIndex: currentIndex,
          sourcePath:
            typeof window !== 'undefined'
              ? `${window.location.pathname || '/'}${window.location.search || ''}`
              : '',
          deepLink: toSafeString(reportContext?.deepLink || '', 500),
          productSlug: toSafeString(reportContext?.productSlug || '', 140),
          shopSlug: toSafeString(reportContext?.shopSlug || '', 140),
          productTitle: toSafeString(reportContext?.productTitle || title || '', 200),
          shopName: toSafeString(reportContext?.shopName || '', 200)
        });
        sendPreviewAnalytics('image_preview_report', reportContext, {
          category: reportCategory
        });
        showToast('Signalement envoyé. Merci.', { variant: 'success' });
        setReportReason('');
        setReportCategory('other');
        setReportOpen(false);
      } catch (error) {
        const message =
          error?.response?.data?.message || error?.message || "Impossible d'envoyer le signalement.";
        setReportError(message);
        showToast(message, { variant: 'error' });
      } finally {
        setReporting(false);
      }
    },
    [reportContext, reportCategory, reportReason, safeImages, currentIndex, currentImage, showToast, title]
  );

  const handleTouchStart = useCallback(
    (event) => {
      const touches = event.touches;
      if (!touches) return;

      if (touches.length === 2) {
        const [a, b] = touches;
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchRef.current = {
          active: true,
          startDistance: distance,
          startScale: scale
        };
        panRef.current.active = false;
        return;
      }

      if (touches.length === 1 && scale > 1) {
        const touch = touches[0];
        panRef.current = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          startTranslateX: translate.x,
          startTranslateY: translate.y
        };
      }
    },
    [scale, translate.x, translate.y]
  );

  const handleTouchMove = useCallback(
    (event) => {
      const touches = event.touches;
      if (!touches) return;

      if (touches.length === 2 && pinchRef.current.active) {
        event.preventDefault();
        const [a, b] = touches;
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = distance / Math.max(1, pinchRef.current.startDistance);
        const nextScale = pinchRef.current.startScale * ratio;
        applyScale(nextScale);
        return;
      }

      if (touches.length === 1 && panRef.current.active && scale > 1) {
        event.preventDefault();
        const touch = touches[0];
        const deltaX = touch.clientX - panRef.current.startX;
        const deltaY = touch.clientY - panRef.current.startY;
        setTranslate({
          x: panRef.current.startTranslateX + deltaX,
          y: panRef.current.startTranslateY + deltaY
        });
      }
    },
    [scale, applyScale]
  );

  const handleTouchEnd = useCallback(
    (event) => {
      const remainingTouches = event.touches?.length || 0;

      if (remainingTouches < 2) {
        pinchRef.current.active = false;
      }
      if (remainingTouches === 0) {
        panRef.current.active = false;
        const now = Date.now();
        const delta = now - tapRef.current.lastAt;
        tapRef.current.lastAt = now;
        if (delta > 0 && delta < 280) {
          setScale((prev) => {
            const next = prev > 1 ? 1 : 2;
            if (next <= 1) {
              setTranslate({ x: 0, y: 0 });
              setHdEnabled(false);
            } else {
              setHdEnabled(true);
              markZoomUsed();
            }
            return next;
          });
        }
      }
    },
    [markZoomUsed]
  );

  const zoomIn = useCallback(() => {
    setScale((prev) => {
      const next = clamp(prev + 0.5, ZOOM_MIN, ZOOM_MAX);
      if (next > 1) {
        setHdEnabled(true);
        markZoomUsed();
      }
      return next;
    });
  }, [markZoomUsed]);

  const zoomOut = useCallback(() => {
    setScale((prev) => {
      const next = clamp(prev - 0.5, ZOOM_MIN, ZOOM_MAX);
      if (next <= 1) {
        setTranslate({ x: 0, y: 0 });
        setHdEnabled(false);
      }
      return next;
    });
  }, []);
  const zoomPercent = Math.round(scale * 100);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      fullscreen
      mobileSheet={false}
      ariaLabel="Aperçu image"
      rootClassName="sm:!p-0"
      backdropClassName="!bg-[#070707]/94 backdrop-blur-md"
      panelClassName="sm:max-w-6xl !border-0 !bg-[#0b0b0b] text-white shadow-none sm:rounded-2xl"
    >
      <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#0b0b0b] sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-44 bg-gradient-to-t from-black via-black/70 to-transparent" />

        <div className="absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-3 pt-[env(safe-area-inset-top,0px)]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
            aria-label="Fermer l'aperçu"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 text-center">
            {canNavigate ? (
              <span className="inline-flex rounded-full bg-white/14 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10 backdrop-blur-xl">
                {currentIndex + 1} / {safeImages.length}
              </span>
            ) : null}
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
              aria-label="Partager"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
              aria-label="Actions image"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-3xl border border-gray-200 bg-white p-1.5 text-slate-900 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-gray-100"
                >
                  <Share2 className="h-4 w-4 text-[#e85d00]" />
                  Partager
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-gray-100"
                >
                  <Download className="h-4 w-4 text-[#e85d00]" />
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={handleReportMenuAction}
                  disabled={!canNativeReport}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Flag className="h-4 w-4" />
                  Signaler
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute left-3 top-20 z-20 hidden items-center gap-2 sm:inline-flex">
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
            aria-label="Zoom arrière"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95"
            aria-label="Zoom avant"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>

        {canNavigate ? (
          <>
            <button
              type="button"
              onClick={() => moveIndex(-1)}
              className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95 sm:inline-flex"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => moveIndex(1)}
              className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white shadow-sm ring-1 ring-white/10 backdrop-blur-xl transition hover:bg-white/20 active:scale-95 sm:inline-flex"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="relative z-0 h-full overflow-hidden bg-[#0b0b0b]">
          <div
            className="flex h-full w-full items-center justify-center touch-none px-2 pb-44 pt-20 sm:pb-36"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentImage}
              alt={title || 'Image'}
              className="mx-auto block max-h-full w-auto max-w-full object-contain select-none"
              style={{
                transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                transformOrigin: 'center center',
                transition: pinchRef.current.active || panRef.current.active ? 'none' : 'transform 140ms ease-out'
              }}
              onError={() => {
                if (!shouldUseHighQuality) return;
                setHdImageErrors((prev) => ({ ...prev, [currentIndex]: true }));
              }}
              draggable={false}
            />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:px-5 sm:pb-5">
          {canNavigate ? (
            <div className="mobile-scroll-x mb-3 flex gap-2 overflow-x-auto pb-1">
              {safeImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(index);
                    resetTransform();
                    setMenuOpen(false);
                  }}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 bg-white/10 transition active:scale-95 sm:h-16 sm:w-16 ${
                    index === currentIndex
                      ? 'border-[#e85d00] shadow-[0_0_0_2px_rgba(255,106,0,0.25)]'
                      : 'border-white/18 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Afficher image ${index + 1}`}
                >
                  <img
                    src={lowQualityImages[index] || image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/12 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{title || 'Image produit'}</p>
                <p className="truncate text-xs font-semibold text-white/58">
                  {scale > 1
                    ? 'Déplacez l’image avec un doigt'
                    : 'Double tap pour zoomer · pincez pour agrandir'}
                </p>
              </div>
              {hdEnabled ? (
                <span className="shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-400/20">
                  HD
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {favoriteProduct ? (
                <button
                  type="button"
                  onClick={handleFavoriteToggle}
                  disabled={favoritePending}
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:cursor-wait ${
                    favoriteActive
                      ? 'bg-[#e85d00] text-white shadow-[0_10px_22px_rgba(255,106,0,0.35)]'
                      : 'bg-white/14 text-white ring-1 ring-white/10 hover:bg-white/20'
                  } ${favoritePending ? 'opacity-70' : ''}`}
                  aria-label={favoriteActive ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  aria-pressed={favoriteActive}
                >
                  <motion.span
                    key={heartPulse}
                    initial={reduceMotion || heartPulse === 0 ? false : { scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    className="inline-flex"
                  >
                    <Heart className="h-5 w-5" fill={favoriteActive ? 'currentColor' : 'none'} />
                  </motion.span>
                </button>
              ) : null}

              <div className="flex flex-1 items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition hover:bg-gray-100 active:scale-95 disabled:opacity-50"
                  aria-label="Zoom arrière"
                  disabled={scale <= ZOOM_MIN}
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  className="inline-flex h-11 min-w-[72px] items-center justify-center rounded-full bg-[#e85d00] px-3 text-xs font-black tabular-nums text-white transition active:scale-95"
                  aria-label="Réinitialiser le zoom"
                  title="Réinitialiser le zoom"
                >
                  {zoomPercent}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition hover:bg-gray-100 active:scale-95 disabled:opacity-50"
                  aria-label="Zoom avant"
                  disabled={scale >= ZOOM_MAX}
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {reportOpen ? (
          <div className="absolute inset-0 z-30 flex items-end bg-black/55 p-2 sm:p-5">
            <form
              onSubmit={handleReportSubmit}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">Signaler cette image</p>
                  <p className="text-xs text-slate-500">Ajoutez un motif pour aider la modération.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (reporting) return;
                    setReportOpen(false);
                    setReportError('');
                  }}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Fermer le formulaire de signalement"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <label className="mb-2 block text-xs font-semibold text-slate-600">Motif</label>
              <select
                value={reportCategory}
                onChange={(event) => setReportCategory(event.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                disabled={reporting}
              >
                {REPORT_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="mb-2 block text-xs font-semibold text-slate-600">Détail (optionnel)</label>
              <textarea
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ajoutez un détail utile pour la modération..."
                className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm"
                disabled={reporting}
              />
              <p className="mt-1 text-[11px] text-slate-400">{reportReason.length}/500</p>

              {reportError ? (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{reportError}</p>
              ) : null}

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (reporting) return;
                    setReportOpen(false);
                    setReportError('');
                  }}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  disabled={reporting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={reporting}
                >
                  {reporting ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}
