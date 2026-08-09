import { describe, expect, it } from 'vitest';
import { detectMobilePlatform, resolveGuidePlatform } from './MobileAppGuide';

describe('mobile app guide platform detection', () => {
  it('detects Apple mobile browsers', () => {
    expect(detectMobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
  });

  it('detects Android browsers', () => {
    expect(detectMobilePlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
  });

  it('uses a neutral fallback on desktop', () => {
    expect(detectMobilePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('other');
  });
});

describe('mobile app guide deep links', () => {
  it('opens the iPhone guide from the Apple footer badge', () => {
    expect(resolveGuidePlatform('ios', 'android')).toBe('ios');
  });

  it('opens the Android guide from the Google Play footer badge', () => {
    expect(resolveGuidePlatform('android', 'ios')).toBe('android');
  });
});
