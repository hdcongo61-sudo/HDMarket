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
