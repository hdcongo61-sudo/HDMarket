import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ consent: vi.fn(), init: vi.fn(), subscribe: vi.fn(), send: vi.fn(), options: {} }));
vi.mock('../services/privacyPreferences', () => ({ hasDiagnosticsConsent: mocks.consent, subscribePrivacyPreference: mocks.subscribe, hasAnalyticsConsent: () => false }));
vi.mock('@sentry/react', () => ({ init: mocks.init, getClient: () => ({ getOptions: () => mocks.options }), makeFetchTransport: () => ({ send: mocks.send }), setUser: vi.fn() }));
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); mocks.consent.mockReturnValue(false);
  vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.test/1');
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { origin: 'https://hdmarket.test' } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('optional diagnostics', () => {
  it('does not initialize before diagnostic consent and responds to later choices', async () => {
    const { initErrorTracking } = await import('./errorTracking');
    initErrorTracking();
    expect(mocks.init).not.toHaveBeenCalled();
    mocks.consent.mockReturnValue(true);
    mocks.subscribe.mock.calls[0][0]();
    expect(mocks.init).toHaveBeenCalledTimes(1);
    mocks.consent.mockReturnValue(false);
    mocks.subscribe.mock.calls[0][0]();
    expect(mocks.options.enabled).toBe(false);
  });
  it('blocks queued envelopes at transport time after withdrawal', async () => {
    mocks.consent.mockReturnValue(true);
    const { initErrorTracking } = await import('./errorTracking');
    initErrorTracking();
    const transport = mocks.init.mock.calls[0][0].transport({});
    mocks.consent.mockReturnValue(false);
    await transport.send({ private: true });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('removes user details, form data, breadcrumbs and private URLs', async () => {
    mocks.consent.mockReturnValue(true);
    const { sanitizeDiagnosticEvent } = await import('./errorTracking');
    const event = sanitizeDiagnosticEvent({ user: { id: 'secret' }, message: 'private email', request: { url: 'https://hdmarket.test/reset-password/secret?token=private', data: 'private' }, breadcrumbs: [{ message: 'private' }], extra: { private: true }, exception: { values: [{ type: 'TypeError', value: 'private' }] } });
    expect(JSON.stringify(event)).not.toMatch(/private|secret/);
    expect(event.request.url).toBe('https://hdmarket.test/other');
    mocks.consent.mockReturnValue(false);
    expect(sanitizeDiagnosticEvent({})).toBeNull();
  });
});
