import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import {
  getNextVideoChunkRange,
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
