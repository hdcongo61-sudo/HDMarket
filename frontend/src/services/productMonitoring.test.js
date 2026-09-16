import { afterEach, describe, expect, it, vi } from 'vitest';
import { monitoringPage, sanitizeMonitoringEvent, isPublicPostHogKey } from './productMonitoring';
afterEach(() => vi.unstubAllGlobals());
describe('monitoring privacy', () => {
  it('groups product and private routes without identifiers or tokens', () => {
    expect(monitoringPage('/product/private-slug?q=email@example.com')).toBe('/product/:item');
    expect(monitoringPage('/orders/detail/secret-id')).toBe('/orders/:detail');
    expect(monitoringPage('/payment/pawapay/return?checkoutCode=secret')).toBe('/payment');
    expect(monitoringPage('/reset-password/secret')).toBe('/other');
  });
  it('keeps useful shopping funnel routes separate', () => {
    expect(monitoringPage('/cart')).toBe('/cart');
    expect(monitoringPage('/orders/checkout')).toBe('/orders/checkout');
    expect(monitoringPage('/search?q=private')).toBe('/search');
  });
  it('removes SDK URLs, referrers, text and personal traits except safe fields', () => {
    vi.stubGlobal('window', { location: { origin: 'https://hdmarket.store' } });
    const result = sanitizeMonitoringEvent({ event: '$pageview', properties: {
      $current_url: 'https://hdmarket.store/orders/detail/secret?token=private',
      $referrer: 'https://other.test/?secret=123', email: 'private', text: 'message',
      auth_state: 'guest', $session_id: 'session', $set: { email: 'private', role: 'user' }
    } });
    expect(result.properties).toEqual({ $current_url: 'https://hdmarket.store/orders/:detail', auth_state: 'guest', $session_id: 'session', $set: { role: 'user' } });
  });
  it('drops unapproved event types', () => expect(sanitizeMonitoringEvent({ event: '$autocapture', properties: { text: 'private' } })).toBeNull());
});

describe('PostHog project token validation', () => {
  it('accepts public project tokens and rejects personal keys and placeholders', () => {
    expect(isPublicPostHogKey('phc_test123')).toBe(true);
    for (const value of ['phx_test123', '', undefined, 'project-token', 'phc_abc def']) {
      expect(isPublicPostHogKey(value)).toBe(false);
    }
  });
});
