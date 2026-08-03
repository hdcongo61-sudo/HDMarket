export const PRODUCT_CARD_GALLERY_FEATURE = 'product_card_multi_image_preview';

export const PRODUCT_CARD_GALLERY_DEFAULTS = Object.freeze({
  enabled: true,
  enableCarousel: true,
  enableSwipe: true,
  enableAutoPreview: false,
  enableCounter: true,
  enableThumbnailPreview: true,
  animationSpeedMs: 360,
  lazyLoadDistancePx: 400,
  defaultDisplayMode: 'swipe',
  maxImagesToPreload: 1,
  variant: 'control'
});

const toBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const normalizeMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['swipe', 'stacked', 'thumbnail'].includes(normalized) ? normalized : 'swipe';
};

export const resolveProductCardGalleryConfig = ({
  runtime = {},
  featureFlags = {},
  carouselOverride
} = {}) => {
  const feature = featureFlags?.[PRODUCT_CARD_GALLERY_FEATURE];
  const featureKnown = typeof feature === 'boolean' || (feature && typeof feature === 'object');
  const featureEnabled = typeof feature === 'boolean'
    ? feature
    : toBoolean(feature?.enabled, PRODUCT_CARD_GALLERY_DEFAULTS.enabled);
  const remote = featureEnabled && feature && typeof feature === 'object'
    ? feature.config || {}
    : {};

  const globalCarousel = toBoolean(
    runtime.enable_product_card_image_carousel,
    PRODUCT_CARD_GALLERY_DEFAULTS.enableCarousel
  );
  const enableCarousel = toBoolean(
    firstDefined(remote.enableCarousel, remote.enable_carousel, carouselOverride, globalCarousel),
    globalCarousel
  );

  return {
    enabled: (featureKnown ? featureEnabled : PRODUCT_CARD_GALLERY_DEFAULTS.enabled),
    enableCarousel,
    enableSwipe: toBoolean(
      firstDefined(remote.enableSwipe, remote.enable_swipe, runtime.enable_product_card_image_swipe),
      PRODUCT_CARD_GALLERY_DEFAULTS.enableSwipe
    ),
    enableAutoPreview: toBoolean(
      firstDefined(remote.enableAutoPreview, remote.enable_auto_preview, runtime.enable_product_card_auto_preview),
      PRODUCT_CARD_GALLERY_DEFAULTS.enableAutoPreview
    ),
    enableCounter: toBoolean(
      firstDefined(remote.enableCounter, remote.enable_counter, runtime.enable_product_card_image_counter),
      PRODUCT_CARD_GALLERY_DEFAULTS.enableCounter
    ),
    enableThumbnailPreview: toBoolean(
      firstDefined(
        remote.enableThumbnailPreview,
        remote.enable_thumbnail_preview,
        runtime.enable_product_card_thumbnail_preview
      ),
      PRODUCT_CARD_GALLERY_DEFAULTS.enableThumbnailPreview
    ),
    animationSpeedMs: clampNumber(
      firstDefined(
        remote.animationSpeedMs,
        remote.animation_speed_ms,
        runtime.product_card_gallery_animation_speed_ms
      ),
      PRODUCT_CARD_GALLERY_DEFAULTS.animationSpeedMs,
      160,
      800
    ),
    lazyLoadDistancePx: clampNumber(
      firstDefined(
        remote.lazyLoadDistancePx,
        remote.lazy_load_distance_px,
        runtime.product_card_gallery_lazy_load_distance_px
      ),
      PRODUCT_CARD_GALLERY_DEFAULTS.lazyLoadDistancePx,
      0,
      1600
    ),
    defaultDisplayMode: normalizeMode(firstDefined(
      remote.defaultDisplayMode,
      remote.default_display_mode,
      runtime.product_card_gallery_default_mode
    )),
    maxImagesToPreload: Math.round(clampNumber(
      firstDefined(
        remote.maxImagesToPreload,
        remote.max_images_to_preload,
        runtime.product_card_gallery_max_preload
      ),
      PRODUCT_CARD_GALLERY_DEFAULTS.maxImagesToPreload,
      0,
      1
    )),
    variant: String(feature?.variant || PRODUCT_CARD_GALLERY_DEFAULTS.variant)
  };
};
