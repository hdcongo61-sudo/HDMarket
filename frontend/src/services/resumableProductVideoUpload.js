import api from './api';
import { createIdempotencyKey } from '../utils/idempotency';

export const DEFAULT_VIDEO_CHUNK_SIZE = 1024 * 1024;

export const getNextVideoChunkRange = (offset, fileSize, chunkSize = DEFAULT_VIDEO_CHUNK_SIZE) => {
  const safeSize = Math.max(0, Number(fileSize || 0));
  const start = Math.min(safeSize, Math.max(0, Number(offset || 0)));
  const size = Math.max(1, Number(chunkSize || DEFAULT_VIDEO_CHUNK_SIZE));
  return { start, end: Math.min(safeSize, start + size) };
};

const wait = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });

const requestStatus = async (uploadId, signal) => {
  const { data } = await api.get(`/product-videos/seller/resumable/${uploadId}`, {
    signal,
    headers: { 'x-skip-cache': '1' },
    silentGlobalError: true
  });
  return data;
};

const waitForProcessing = async (uploadId, signal, onProgress, fileSize) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await requestStatus(uploadId, signal);
    if (status?.state === 'completed') return status;
    onProgress?.({ offset: fileSize, total: fileSize, progress: 100, state: 'processing' });
    await wait(2000, signal);
  }
  const error = new Error('Le traitement de la vidéo prend trop de temps. Appuyez sur Réessayer pour vérifier son état.');
  error.code = 'VIDEO_PROCESSING_TIMEOUT';
  throw error;
};

export const uploadResumableProductVideo = async ({
  file,
  productId,
  caption,
  session = {},
  signal,
  onSession,
  onProgress
}) => {
  let uploadId = String(session?.uploadId || '');
  let completeKey = String(session?.completeKey || '') || createIdempotencyKey('product-video-complete');
  let offset = 0;
  let chunkSize = DEFAULT_VIDEO_CHUNK_SIZE;

  if (uploadId) {
    try {
      const status = await requestStatus(uploadId, signal);
      if (status?.state === 'completed') {
        onProgress?.({ offset: file.size, total: file.size, progress: 100, state: 'completed' });
        return { data: status, session: { uploadId, completeKey, offset: file.size } };
      }
      if (status?.state === 'processing') {
        const completed = await waitForProcessing(uploadId, signal, onProgress, file.size);
        return { data: completed, session: { uploadId, completeKey, offset: file.size } };
      }
      offset = Math.min(file.size, Math.max(0, Number(status?.offset || 0)));
      chunkSize = Math.max(1, Number(status?.chunkSize || DEFAULT_VIDEO_CHUNK_SIZE));
    } catch (error) {
      if (signal?.aborted) throw error;
      if (Number(error?.response?.status || 0) !== 404) throw error;
      uploadId = '';
      offset = 0;
      completeKey = createIdempotencyKey('product-video-complete');
    }
  }

  if (!uploadId) {
    const { data } = await api.post(
      '/product-videos/seller/resumable/start',
      {
        productId,
        caption,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified
      },
      { signal, silentGlobalError: true }
    );
    uploadId = String(data.uploadId || '');
    offset = Number(data.offset || 0);
    chunkSize = Math.max(1, Number(data.chunkSize || DEFAULT_VIDEO_CHUNK_SIZE));
  }

  onSession?.({ uploadId, completeKey, offset });
  onProgress?.({
    offset,
    total: file.size,
    progress: file.size ? Math.round((offset / file.size) * 100) : 0,
    state: 'uploading'
  });

  while (offset < file.size) {
    const range = getNextVideoChunkRange(offset, file.size, chunkSize);
    const chunk = file.slice(range.start, range.end);
    try {
      const { data } = await api.put(
        `/product-videos/seller/resumable/${uploadId}/chunk`,
        chunk,
        {
          signal,
          silentGlobalError: true,
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-upload-offset': String(range.start)
          }
        }
      );
      offset = Math.min(file.size, Math.max(range.start, Number(data?.offset || range.end)));
    } catch (error) {
      const serverOffset = Number(error?.response?.data?.offset);
      if (Number(error?.response?.status || 0) === 409 && Number.isFinite(serverOffset)) {
        offset = Math.min(file.size, Math.max(0, serverOffset));
      } else {
        throw error;
      }
    }
    onSession?.({ uploadId, completeKey, offset });
    onProgress?.({
      offset,
      total: file.size,
      progress: file.size ? Math.min(100, Math.round((offset / file.size) * 100)) : 0,
      state: offset >= file.size ? 'processing' : 'uploading'
    });
  }

  try {
    const { data } = await api.post(
      `/product-videos/seller/resumable/${uploadId}/complete`,
      {},
      {
        signal,
        silentGlobalError: true,
        headers: { 'Idempotency-Key': completeKey }
      }
    );
    onProgress?.({ offset: file.size, total: file.size, progress: 100, state: 'completed' });
    return { data, session: { uploadId, completeKey, offset: file.size } };
  } catch (error) {
    if (signal?.aborted) throw error;
    const statusCode = Number(error?.response?.status || 0);
    const errorCode = String(error?.response?.data?.code || '');
    if (!error?.response || (statusCode === 409 && errorCode === 'UPLOAD_PROCESSING')) {
      const status = await requestStatus(uploadId, signal).catch(() => null);
      if (status?.state === 'completed') {
        return { data: status, session: { uploadId, completeKey, offset: file.size } };
      }
      if (status?.state === 'processing') {
        const completed = await waitForProcessing(uploadId, signal, onProgress, file.size);
        return { data: completed, session: { uploadId, completeKey, offset: file.size } };
      }
    }
    throw error;
  }
};

export const discardResumableProductVideoUpload = async (uploadId) => {
  if (!uploadId) return;
  await api.delete(`/product-videos/seller/resumable/${uploadId}`, { silentGlobalError: true });
};
