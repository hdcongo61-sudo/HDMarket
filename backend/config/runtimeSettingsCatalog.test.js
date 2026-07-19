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
