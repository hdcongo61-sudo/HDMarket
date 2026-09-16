import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ pipeline: vi.fn(), fromBlob: vi.fn() }));
vi.mock('@huggingface/transformers', () => ({ pipeline: mocks.pipeline, RawImage: { fromBlob: mocks.fromBlob } }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal('self', { postMessage: vi.fn() }); });
afterEach(() => vi.unstubAllGlobals());
describe('background-removal worker pipeline', () => {
  it('uses batched inputs and exports the first transparent result', async () => {
    const blob = new Blob(['source']);
    const image = { width: 20, height: 20 };
    const output = new Blob(['transparent result'], { type: 'image/png' });
    const segmenter = vi.fn(async input => Array.isArray(input) ? [{ toBlob: async () => output }] : { toBlob: async () => output });
    mocks.pipeline.mockResolvedValue(segmenter);
    mocks.fromBlob.mockResolvedValue(image);
    await import('./backgroundRemoval.worker');
    await self.onmessage({ data: { id: 1, blob } });
    expect(segmenter).toHaveBeenCalledWith([image]);
    expect(self.postMessage).toHaveBeenCalledWith({ id: 1, status: 'done', blob: output });
  });
  it('allows another download after model initialization fails', async () => {
    mocks.pipeline.mockRejectedValueOnce(new Error('Download interrupted'))
      .mockResolvedValueOnce(async () => [{ toBlob: async () => new Blob() }]);
    mocks.fromBlob.mockResolvedValue({});
    await import('./backgroundRemoval.worker');
    await self.onmessage({ data: { id: 1, blob: new Blob() } });
    await self.onmessage({ data: { id: 2, blob: new Blob() } });
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
    expect(self.postMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 2, status: 'done' }));
  });
});
