import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import {
  getNextVideoChunkRange,
  runSequentialVideoUploadQueue,
  uploadResumableProductVideo
} from './resumableProductVideoUpload';

vi.mock('./api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resumable video chunk ranges', () => {
  it('continues at the last confirmed byte', () => {
    expect(getNextVideoChunkRange(1024, 4096, 1024)).toEqual({ start: 1024, end: 2048 });
  });

  it('limits the last chunk to the file size', () => {
    expect(getNextVideoChunkRange(3072, 3500, 1024)).toEqual({ start: 3072, end: 3500 });
  });

  it('does not restart when the confirmed offset is already complete', () => {
    expect(getNextVideoChunkRange(4096, 4096, 1024)).toEqual({ start: 4096, end: 4096 });
  });
});

describe('sequential video upload queue', () => {
  it('finishes each video before starting the next one', async () => {
    const events = [];
    let activeUploads = 0;
    let maximumConcurrentUploads = 0;

    const outcomes = await runSequentialVideoUploadQueue([2, 0, 1], async (index) => {
      events.push(`start-${index}`);
      activeUploads += 1;
      maximumConcurrentUploads = Math.max(maximumConcurrentUploads, activeUploads);
      await Promise.resolve();
      activeUploads -= 1;
      events.push(`end-${index}`);
      return { status: 'completed' };
    });

    expect(maximumConcurrentUploads).toBe(1);
    expect(events).toEqual(['start-2', 'end-2', 'start-0', 'end-0', 'start-1', 'end-1']);
    expect(Array.from(outcomes.keys())).toEqual([2, 0, 1]);
  });

  it('does not start another video after cancellation', async () => {
    const controller = new AbortController();
    const attempted = [];

    await runSequentialVideoUploadQueue([0, 1], async (index) => {
      attempted.push(index);
      controller.abort();
      return { status: 'cancelled' };
    }, controller.signal);

    expect(attempted).toEqual([0]);
  });
});

describe('resumable video upload', () => {
  it('asks the server for its offset and sends only the remaining bytes', async () => {
    const slice = vi.fn((start, end) => new Uint8Array(end - start));
    const file = {
      name: 'demo.mp4',
      type: 'video/mp4',
      size: 3072,
      lastModified: 123,
      slice
    };
    api.get.mockResolvedValue({
      data: { state: 'uploading', offset: 1024, size: 3072, chunkSize: 1024 }
    });
    api.put
      .mockResolvedValueOnce({ data: { offset: 2048 } })
      .mockResolvedValueOnce({ data: { offset: 3072 } });
    api.post.mockResolvedValue({ data: { item: { _id: 'video-1' } } });

    await uploadResumableProductVideo({
      file,
      productId: 'product-1',
      caption: 'Démo',
      session: { uploadId: 'existing-upload', completeKey: 'stable-complete-key' }
    });

    expect(api.get).toHaveBeenCalledWith(
      '/product-videos/seller/resumable/existing-upload',
      expect.any(Object)
    );
    expect(slice.mock.calls).toEqual([
      [1024, 2048],
      [2048, 3072]
    ]);
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe(
      '/product-videos/seller/resumable/existing-upload/complete'
    );
  });
});
