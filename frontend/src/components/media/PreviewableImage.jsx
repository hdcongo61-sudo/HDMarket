import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand } from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';
import useNetworkProfile from '../../hooks/useNetworkProfile';
import ImagePreviewModal from './ImagePreviewModal';

const OBJECT_PLACEHOLDER = '/api/placeholder/400/400';

const toBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

export default function PreviewableImage({
  src,
  alt = 'Image',
  images,
  highResImages,
  startIndex = 0,
  openOnClick = false,
  className = '',
  loading = 'lazy',
  showHint = true,
  onReport,
  reportContext,
  ...imgProps
}) {
  const { getRuntimeValue } = useAppSettings();
  const { rapid3GActive } = useNetworkProfile();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(startIndex);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });

  const previewEnabled = useMemo(
    () => toBoolean(getRuntimeValue('enable_long_press_image_preview', true), true),
    [getRuntimeValue]
  );

  const safeImages = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.filter(Boolean);
    }
    return [src || OBJECT_PLACEHOLDER];
  }, [images, src]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const cancelLongPress = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const openPreview = useCallback(
    (index = 0) => {
      if (!previewEnabled) return;
      const safeIndex = Math.max(0, Math.min(Number(index) || 0, Math.max(0, safeImages.length - 1)));
      setPreviewIndex(safeIndex);
      setIsPreviewOpen(true);
    },
    [previewEnabled, safeImages.length]
  );

  const startLongPress = useCallback(
    (event) => {
      if (!previewEnabled) return;
      if (event?.pointerType === 'mouse' && event.button !== 0) return;
      longPressTriggeredRef.current = false;
      pointerStartRef.current = {
        x: Number(event?.clientX || 0),
        y: Number(event?.clientY || 0)
      };
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        openPreview(startIndex);
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(10);
        }
      }, 430);
    },
    [previewEnabled, clearLongPressTimer, openPreview, startIndex]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!longPressTimerRef.current) return;
      const currentX = Number(event?.clientX || 0);
      const currentY = Number(event?.clientY || 0);
      const deltaX = Math.abs(currentX - pointerStartRef.current.x);
      const deltaY = Math.abs(currentY - pointerStartRef.current.y);
      if (deltaX > 14 || deltaY > 14) {
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer]
  );

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return (
    <>
      <img
        src={src || OBJECT_PLACEHOLDER}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={rapid3GActive ? 'low' : undefined}
        sizes={imgProps.sizes || '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
        className={className}
        onPointerDown={startLongPress}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onClickCapture={(event) => {
          if (!longPressTriggeredRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          longPressTriggeredRef.current = false;
        }}
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          if (!openOnClick || !previewEnabled) return;
          event.preventDefault();
          openPreview(startIndex);
        }}
        {...imgProps}
      />

      {showHint && previewEnabled ? (
        <span className="pointer-events-none absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Expand className="h-3.5 w-3.5" />
        </span>
      ) : null}

      <ImagePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        images={safeImages}
        highResImages={Array.isArray(highResImages) ? highResImages : []}
        initialIndex={previewIndex}
        title={alt}
        onReport={onReport}
        reportContext={reportContext}
      />
    </>
  );
}
