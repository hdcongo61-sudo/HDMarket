import { describe, expect, it } from 'vitest';
import {
  getRuntimeSettingMetadata,
  validateSettingValue
} from './runtimeSettingsCatalog.js';

describe('enable_dark_theme runtime setting', () => {
  it('is public, enabled by default, and accepts a boolean override', () => {
    expect(getRuntimeSettingMetadata('enable_dark_theme')).toMatchObject({
      category: 'ui',
      valueType: 'boolean',
      defaultValue: true,
      isPublic: true
    });
    expect(validateSettingValue('enable_dark_theme', false)).toMatchObject({
      ok: true,
      value: false
    });
  });
});

describe('authentication provider runtime settings', () => {
  it('exposes independent public login and registration switches', () => {
    const keys = ['email', 'google', 'apple'].flatMap((provider) => [
      `auth_${provider}_login_enabled`,
      `auth_${provider}_registration_enabled`
    ]);

    for (const key of keys) {
      expect(getRuntimeSettingMetadata(key)).toMatchObject({
        category: 'authentication',
        valueType: 'boolean',
        defaultValue: true,
        isPublic: true
      });
      expect(validateSettingValue(key, false)).toMatchObject({ ok: true, value: false });
    }
  });
});

describe('app_information runtime setting', () => {
  it('is public and validates the managed application identity', () => {
    const metadata = getRuntimeSettingMetadata('app_information');
    expect(metadata).toMatchObject({
      category: 'app_identity',
      valueType: 'json',
      isPublic: true
    });
    expect(validateSettingValue('app_information', metadata.defaultValue)).toMatchObject({ ok: true });
    expect(validateSettingValue('app_information', {
      ...metadata.defaultValue,
      supportEmail: 'invalid-email'
    })).toMatchObject({ ok: false });
    expect(validateSettingValue('app_information', {
      ...metadata.defaultValue,
      facebook: 'javascript:alert(1)'
    })).toMatchObject({ ok: false });
  });
});

describe('product card gallery runtime settings', () => {
  it('exposes safe public defaults and validates bounded performance controls', () => {
    expect(getRuntimeSettingMetadata('enable_product_card_image_carousel')).toMatchObject({
      category: 'product_cards',
      valueType: 'boolean',
      defaultValue: true,
      isPublic: true
    });
    expect(getRuntimeSettingMetadata('product_card_gallery_max_preload')).toMatchObject({
      defaultValue: 1,
      min: 0,
      max: 1,
      isPublic: true
    });
    expect(validateSettingValue('product_card_gallery_default_mode', 'thumbnail')).toMatchObject({
      ok: true,
      value: 'thumbnail'
    });
    expect(validateSettingValue('product_card_gallery_default_mode', 'unknown')).toMatchObject({
      ok: false
    });
    expect(validateSettingValue('product_card_gallery_max_preload', 2)).toMatchObject({
      ok: false
    });
  });
});

describe('HDMarket Videos runtime settings', () => {
  it('keeps client performance controls public and moderation private', () => {
    expect(getRuntimeSettingMetadata('product_video_max_duration_seconds')).toMatchObject({
      category: 'product_videos',
      defaultValue: 60,
      min: 10,
      max: 180,
      isPublic: true
    });
    expect(getRuntimeSettingMetadata('product_video_preload_count')).toMatchObject({
      defaultValue: 1,
      min: 0,
      max: 2,
      isPublic: true
    });
    expect(getRuntimeSettingMetadata('product_video_require_moderation')).toMatchObject({
      defaultValue: true,
      isPublic: false
    });
    expect(validateSettingValue('product_video_max_duration_seconds', 181)).toMatchObject({ ok: false });
    expect(validateSettingValue('product_video_preload_count', 2)).toMatchObject({ ok: true, value: 2 });
  });
});
