import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  consent: vi.fn(), supported: vi.fn(), initialize: vi.fn(), log: vi.fn(), collection: vi.fn(), post: vi.fn(), setConsent: vi.fn()
}));
vi.mock('./privacyPreferences', () => ({ hasAnalyticsConsent: mocks.consent }));
vi.mock('./api', () => ({ default: { post: mocks.post } }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [] }));
vi.mock('firebase/analytics', () => ({ initializeAnalytics: mocks.initialize, isSupported: mocks.supported, logEvent: mocks.log, setAnalyticsCollectionEnabled: mocks.collection, setUserId: vi.fn(), setUserProperties: vi.fn(), setConsent: mocks.setConsent }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.consent.mockReturnValue(false); mocks.supported.mockResolvedValue(true); mocks.initialize.mockReturnValue({});
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'public-test-config');
  vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST');
  vi.stubGlobal('window', { location: { origin: 'https://hdmarket.test', pathname: '/search', href: 'https://hdmarket.test/search?q=private' } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('analytics consent at the service boundary', () => {
  it('does not initialize or send through any entry point before consent', async () => {
    const analytics = await import('./analytics');
    await analytics.trackPageView({ path: '/profile' });
    await analytics.trackEvent('product_card_interaction', { action: 'click' });
    await analytics.setAnalyticsUser({ _id: 'private' });
    await analytics.trackRealtimeMonitoringEvent({ eventType: 'page_view' });
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('rechecks consent after asynchronous initialization work', async () => {
    mocks.consent.mockReturnValue(true);
    let resolve;
    mocks.supported.mockReturnValue(new Promise(done => { resolve = done; }));
    const analytics = await import('./analytics');
    const pending = analytics.trackPageView({ path: '/cart' });
    mocks.consent.mockReturnValue(false);
    resolve(true);
    await pending;
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });
  it('removes private URLs, entity IDs and arbitrary event properties', async () => {
    mocks.consent.mockReturnValue(true);
    const analytics = await import('./analytics');
    await analytics.trackPageView({ path: '/orders/private?token=secret', title: 'private title' });
    await analytics.trackEvent('product_card_interaction', { action: 'click', product_id: 'secret-product', email: 'private', query: 'secret-search' });
    await analytics.trackRealtimeMonitoringEvent({ eventType: 'page_view', path: '/product/secret-product?token=secret', entityId: 'secret-product' });
    const sent = JSON.stringify([mocks.log.mock.calls, mocks.post.mock.calls]);
    for (const value of ['private', 'secret', 'token', 'email']) expect(sent).not.toContain(value);
    expect(mocks.log.mock.calls[0][2].page_path).toBe('/orders/:detail');
    expect(mocks.initialize.mock.calls[0][1].config.send_page_view).toBe(false);
  });
  it('stops collection immediately on withdrawal and supports a later grant', async () => {
    mocks.consent.mockReturnValue(true);
    const analytics = await import('./analytics');
    await analytics.trackPageView({ path: '/' });
    mocks.consent.mockReturnValue(false);
    analytics.disableAnalytics();
    await analytics.trackPageView({ path: '/cart' });
    expect(mocks.log).toHaveBeenCalledTimes(1);
    expect(mocks.collection).toHaveBeenLastCalledWith({}, false);
    expect(window['ga-disable-G-TEST']).toBe(true);
    mocks.consent.mockReturnValue(true);
    await analytics.trackPageView({ path: '/cart' });
    expect(mocks.collection).toHaveBeenLastCalledWith({}, true);
    expect(window['ga-disable-G-TEST']).toBe(false);
  });
});
