import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CARD_GALLERY_FEATURE,
  resolveProductCardGalleryConfig
} from './productCardGalleryConfig';

describe('resolveProductCardGalleryConfig', () => {
  it('uses performance-safe released defaults', () => {
    expect(resolveProductCardGalleryConfig()).toMatchObject({
      enabled: true,
      enableCarousel: true,
      enableSwipe: true,
      enableAutoPreview: false,
      defaultDisplayMode: 'swipe',
      maxImagesToPreload: 1
    });
  });

  it('honors a disabled rollout even when global settings are enabled', () => {
    const config = resolveProductCardGalleryConfig({
      runtime: { enable_product_card_image_carousel: true },
      featureFlags: {
        [PRODUCT_CARD_GALLERY_FEATURE]: { enabled: false, variant: 'control' }
      }
    });
    expect(config.enabled).toBe(false);
  });

  it('lets an assigned experiment override global defaults within safe bounds', () => {
    const config = resolveProductCardGalleryConfig({
      runtime: {
        enable_product_card_auto_preview: false,
        product_card_gallery_default_mode: 'stacked'
      },
      featureFlags: {
        [PRODUCT_CARD_GALLERY_FEATURE]: {
          enabled: true,
          variant: 'motion_fast',
          config: {
            enableAutoPreview: true,
            defaultDisplayMode: 'thumbnail',
            animationSpeedMs: 5000,
            maxImagesToPreload: 8
          }
        }
      }
    });
    expect(config).toMatchObject({
      enabled: true,
      variant: 'motion_fast',
      enableAutoPreview: true,
      defaultDisplayMode: 'thumbnail',
      animationSpeedMs: 800,
      maxImagesToPreload: 1
    });
  });
});

