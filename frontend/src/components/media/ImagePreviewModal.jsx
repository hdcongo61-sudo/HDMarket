import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Flag, Share2, X, ZoomIn, ZoomOut } from 'lucide-react';
import BaseModal from '../modals/BaseModal';
import { useToast } from '../../context/ToastContext';
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
  reportContext = null
}) {
  const { showToast } = useToast();
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      mobileSheet={false}
      ariaLabel="Aperçu image"
      backdropClassName="!bg-black/92 backdrop-blur-sm"
      panelClassName="sm:max-w-6xl border-black/40 bg-black/95 text-white"
    >
      <div className="relative w-full p-2 sm:p-4">
        <div className="absolute left-3 top-3 z-20 inline-flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
            aria-label="Zoom arrière"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
            aria-label="Zoom avant"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>

        <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
              aria-label="Actions image"
            >
              <Share2 className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Share2 className="h-4 w-4" />
                  Partager
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={handleReportMenuAction}
                  disabled={!canNativeReport}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Flag className="h-4 w-4" />
                  Signaler
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
            aria-label="Fermer l'aperçu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {canNavigate ? (
          <>
            <button
              type="button"
              onClick={() => moveIndex(-1)}
              className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => moveIndex(1)}
              className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition hover:bg-white"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="max-h-[82vh] overflow-hidden rounded-2xl bg-black">
          <div
            className="flex h-[82vh] w-full items-center justify-center touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentImage}
              alt={title || 'Image'}
              className="mx-auto block max-h-[82vh] w-auto max-w-full object-contain select-none"
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

        <div className="mt-3 flex items-center justify-center gap-2">
          {canNavigate ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {currentIndex + 1} / {safeImages.length}
            </span>
          ) : null}
          {scale > 1 ? (
            <button
              type="button"
              onClick={() => resetTransform()}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30"
            >
              Réinitialiser zoom
            </button>
          ) : null}
          {hdEnabled ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
              HD actif
            </span>
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/80">
              Qualité optimisée réseau lent
            </span>
          )}
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
