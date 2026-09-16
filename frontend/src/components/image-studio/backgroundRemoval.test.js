import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let instances;
class FakeWorker {
  constructor() { instances.push(this); }
  postMessage = vi.fn();
  terminate = vi.fn();
}
beforeEach(() => { instances = []; vi.resetModules(); vi.stubGlobal('Worker', FakeWorker); });
afterEach(() => vi.unstubAllGlobals());
describe('local background removal', () => {
  it('reports progress and returns the transparent result', async () => {
    const { removeBackgroundLocally } = await import('./backgroundRemoval');
    const onProgress = vi.fn();
    const result = new Blob(['png'], { type: 'image/png' });
    const pending = removeBackgroundLocally(new Blob(['source']), { onProgress });
    const worker = instances[0];
    const { id } = worker.postMessage.mock.calls[0][0];
    worker.onmessage({ data: { id, status: 'downloading', percent: 50 } });
    worker.onmessage({ data: { id, status: 'done', blob: result } });
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(await pending).toBe(result);
  });
  it('cancels work and starts a fresh worker on retry', async () => {
    const { removeBackgroundLocally } = await import('./backgroundRemoval');
    const controller = new AbortController();
    const pending = removeBackgroundLocally(new Blob(), { signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(instances[0].terminate).toHaveBeenCalledOnce();
    const retry = removeBackgroundLocally(new Blob());
    expect(instances).toHaveLength(2);
    const { id } = instances[1].postMessage.mock.calls[0][0];
    instances[1].onmessage({ data: { id, status: 'done', blob: new Blob() } });
    await retry;
  });
  it('releases a crashed worker so the next attempt can recover', async () => {
    const { removeBackgroundLocally } = await import('./backgroundRemoval');
    const pending = removeBackgroundLocally(new Blob());
    const rejected = expect(pending).rejects.toThrow('Réessayez');
    instances[0].onerror();
    await rejected;
    const retry = removeBackgroundLocally(new Blob());
    expect(instances).toHaveLength(2);
    const { id } = instances[1].postMessage.mock.calls[0][0];
    instances[1].onmessage({ data: { id, status: 'done', blob: new Blob() } });
    await retry;
  });
});
