import { describe, expect, it } from 'vitest';
import {
  getVideoFileValidationError,
  getVideoFilesUploadProgress,
  getVideoUploadErrorMessage
} from './videoUploadErrors';

describe('individual video upload progress', () => {
  const files = [{ size: 100 }, { size: 300 }];

  it('advances each file according to its position in the multipart upload', () => {
    expect(getVideoFilesUploadProgress(files, 50, 400)).toEqual([50, 0]);
    expect(getVideoFilesUploadProgress(files, 200, 400)).toEqual([100, 33]);
  });

  it('completes every file when the request is fully uploaded', () => {
    expect(getVideoFilesUploadProgress(files, 400, 400)).toEqual([100, 100]);
  });
});

describe('video upload validation', () => {
  it('accepts supported videos', () => {
    expect(
      getVideoFileValidationError({ name: 'produit.mp4', type: 'video/mp4', size: 1024 })
    ).toBe('');
  });

  it('explains unsupported formats', () => {
    expect(
      getVideoFileValidationError({ name: 'produit.gif', type: 'image/gif', size: 1024 })
    ).toContain('MP4, MOV ou WEBM');
  });
});

describe('video upload request errors', () => {
  it('keeps the server explanation when available', () => {
    expect(
      getVideoUploadErrorMessage({ response: { data: { message: 'Durée maximale dépassée.' } } })
    ).toBe('Durée maximale dépassée.');
  });

  it('explains network interruptions', () => {
    expect(getVideoUploadErrorMessage(new Error('Network Error'))).toContain('connexion');
  });

  it('explains oversized uploads', () => {
    expect(getVideoUploadErrorMessage({ response: { status: 413 } })).toContain('trop volumineuse');
  });
});
