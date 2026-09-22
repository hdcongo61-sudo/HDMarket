import { beforeEach, describe, expect, it, vi } from 'vitest';
const { capture, consent } = vi.hoisted(() => ({ capture: vi.fn(), consent: vi.fn(() => true) }));
vi.mock('./privacyPreferences', () => ({ hasAnalyticsConsent: consent }));
vi.mock('posthog-js', () => ({ default: {
  init: vi.fn(), capture, get_property: vi.fn(), has_opted_out_capturing: () => false,
  register: vi.fn(), identify: vi.fn(), reset: vi.fn(), opt_out_capturing: vi.fn(),
  _send_request: vi.fn(), _send_retriable_request: vi.fn(),
  _requestQueue: { enqueue: vi.fn(), unload: vi.fn(), enable: vi.fn() },
  _retryQueue: { retriableRequest: vi.fn(), unload: vi.fn(), resume: vi.fn() }
} }));
beforeEach(() => {
  vi.resetModules();
  capture.mockClear();
  consent.mockReturnValue(true);
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('VITE_POSTHOG_DEBUG', 'true');
});
describe('server-verified browser payment events', () => {
  it('does not treat a return URL or pending payment as conversion', async () => {
    const { captureConfirmedPayment } = await import('./productMonitoring');
    await captureConfirmedPayment({ checkoutId: 'pending', status: 'COMPLETED', paymentState: 'PENDING' });
    await captureConfirmedPayment({ checkoutId: 'failed', status: 'FAILED', paymentState: 'CONFIRMED' });
    expect(capture).not.toHaveBeenCalled();
  });
  it('counts verified money separately from a successfully created order, without IDs', async () => {
    const { captureConfirmedPayment } = await import('./productMonitoring');
    const checkout = { checkoutId: 'test', status: 'COMPLETED', paymentState: 'CONFIRMED', actionKind: 'ORDER_CHECKOUT', autoValidationState: 'PROCESSING' };
    await captureConfirmedPayment(checkout);
    expect(capture.mock.calls.map(([name]) => name)).toEqual(['payment_confirmed_in_browser']);
    await captureConfirmedPayment({ ...checkout, autoValidationState: 'COMPLETED' });
    await captureConfirmedPayment({ ...checkout, autoValidationState: 'COMPLETED' });
    expect(capture.mock.calls).toEqual([['payment_confirmed_in_browser', { page: '/payment' }], ['order_checkout_completed', { page: '/payment' }]]);
  });
  it('respects refused analytics consent', async () => {
    consent.mockReturnValue(false);
    const { captureConfirmedPayment } = await import('./productMonitoring');
    await captureConfirmedPayment({ checkoutId: 'test', status: 'COMPLETED', paymentState: 'CONFIRMED' });
    expect(capture).not.toHaveBeenCalled();
  });
});
