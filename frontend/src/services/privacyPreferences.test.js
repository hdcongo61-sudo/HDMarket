import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let privacy;
let data;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
  data = new Map();
  vi.stubGlobal('window', Object.assign(new EventTarget(), {
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) },
    setTimeout, clearTimeout
  }));
  privacy = await import('./privacyPreferences');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('explicit, purpose-specific privacy choices', () => {
  it('starts disabled, including legacy, invalid and incomplete stored choices', () => {
    data.set('hdmarket:privacy-preference:v1', 'analytics');
    for (const raw of [undefined, 'analytics', '{}', '{broken', JSON.stringify({ version: privacy.PRIVACY_VERSION, savedAt: Date.now(), analytics: true })]) {
      if (raw) data.set(privacy.PRIVACY_STORAGE_KEY, raw);
      expect(privacy.getPrivacyPreference()).toBe('');
      expect(privacy.hasAnalyticsConsent()).toBe(false);
      expect(privacy.hasDiagnosticsConsent()).toBe(false);
    }
  });
  it('records the date and version without conflating statistics and diagnostics', () => {
    privacy.setPrivacyPreference({ analytics: false, diagnostics: true });
    expect(privacy.hasAnalyticsConsent()).toBe(false);
    expect(privacy.hasDiagnosticsConsent()).toBe(true);
    expect(JSON.parse(data.get(privacy.PRIVACY_STORAGE_KEY))).toEqual({ version: privacy.PRIVACY_VERSION, savedAt: Date.now(), analytics: false, diagnostics: true });
    privacy.setPrivacyPreference('essential');
    expect(privacy.hasDiagnosticsConsent()).toBe(false);
  });
  it('expires grants and refusals and rejects future dates or old policies', () => {
    privacy.setPrivacyPreference('analytics');
    const saved = privacy.getPrivacyChoices();
    for (const change of [{ savedAt: Date.now() - privacy.PRIVACY_MAX_AGE_MS }, { savedAt: Date.now() + 1 }, { version: 'old' }]) {
      data.set(privacy.PRIVACY_STORAGE_KEY, JSON.stringify({ ...saved, ...change }));
      expect(privacy.getPrivacyPreference()).toBe('');
    }
    privacy.setPrivacyPreference('essential');
    vi.advanceTimersByTime(privacy.PRIVACY_MAX_AGE_MS);
    expect(privacy.getPrivacyPreference()).toBe('');
  });
  it.each(['read', 'write'])('remains usable when storage %s is blocked', mode => {
    if (mode === 'read') window.localStorage.getItem = () => { throw new Error('SecurityError'); };
    window.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(privacy.getPrivacyPreference()).toBe('');
    privacy.setPrivacyPreference({ analytics: true, diagnostics: true });
    expect(privacy.hasAnalyticsConsent()).toBe(true);
    privacy.setPrivacyPreference('essential');
    expect(privacy.hasAnalyticsConsent()).toBe(false);
  });
  it('notifies open consumers when another tab withdraws consent or when it expires', () => {
    privacy.setPrivacyPreference('analytics');
    const changes = [];
    const stop = privacy.subscribePrivacyPreference(() => changes.push(privacy.hasAnalyticsConsent()));
    const saved = privacy.getPrivacyChoices();
    data.set(privacy.PRIVACY_STORAGE_KEY, JSON.stringify({ ...saved, analytics: false }));
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: privacy.PRIVACY_STORAGE_KEY });
    window.dispatchEvent(event);
    expect(changes).toEqual([true, false]);
    privacy.setPrivacyPreference('analytics');
    vi.advanceTimersByTime(privacy.PRIVACY_MAX_AGE_MS);
    expect(changes.at(-1)).toBe(false);
    stop();
    const count = changes.length;
    privacy.setPrivacyPreference('analytics');
    expect(changes).toHaveLength(count);
  });
});
