import { describe, expect, it, vi } from 'vitest';
import { guardMonitoringTransport } from './monitoringTransport';

describe('PostHog batches and retries after withdrawal', () => {
  it('drops obsolete queued requests, including after a later grant', () => {
    let consent = true;
    const send = vi.fn();
    const retry = vi.fn();
    const instance = {
      _send_request: send, _send_retriable_request: vi.fn(),
      _requestQueue: { enqueue: vi.fn(), unload: vi.fn(), enable: vi.fn() },
      _retryQueue: { retriableRequest: retry, unload: vi.fn(), resume: vi.fn() }
    };
    const guard = guardMonitoringTransport(instance, () => consent);
    instance._send_request({ data: { event: 'page_view' } });
    const old = send.mock.calls[0][0];
    consent = false;
    guard.revoke();
    instance._send_request(old);
    instance._retryQueue.retriableRequest(old);
    expect(send).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    consent = true;
    guard.resume();
    instance._retryQueue.retriableRequest(old);
    expect(retry).not.toHaveBeenCalled();
    instance._send_request({ data: { event: 'page_view' } });
    expect(send).toHaveBeenCalledTimes(2);
    expect(instance._requestQueue.unload).toHaveBeenCalled();
  });
  it('fails closed when an SDK upgrade removes a required boundary', () => {
    expect(guardMonitoringTransport({}, () => true)).toBeNull();
  });
});
