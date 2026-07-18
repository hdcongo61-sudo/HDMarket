import { describe, expect, it } from 'vitest';
import { isSupportedProductImageFile, PRODUCT_IMAGE_ACCEPT } from './mediaOptimizer';

describe('desktop product image formats', () => {
  it('recognizes common Windows and iPhone extensions when MIME is missing', () => {
    expect(isSupportedProductImageFile({ name: 'catalogue.JFIF', type: '' })).toBe(true);
    expect(isSupportedProductImageFile({ name: 'catalogue.jpg', type: 'image/pjpeg' })).toBe(true);
    expect(isSupportedProductImageFile({ name: 'iphone-photo.HEIC', type: '' })).toBe(true);
    expect(isSupportedProductImageFile({ name: 'iphone-photo.HEIF', type: 'application/octet-stream' })).toBe(true);
  });

  it('supports browser-decodable legacy formats through conversion', () => {
    expect(isSupportedProductImageFile({ name: 'photo.bmp', type: 'image/bmp' })).toBe(true);
    expect(isSupportedProductImageFile({ name: 'photo.gif', type: 'image/gif' })).toBe(true);
    expect(PRODUCT_IMAGE_ACCEPT).toContain('.bmp');
    expect(PRODUCT_IMAGE_ACCEPT).toContain('.heic');
  });

  it('rejects formats without a safe desktop decoder', () => {
    expect(isSupportedProductImageFile({ name: 'scan.tiff', type: 'image/tiff' })).toBe(false);
    expect(isSupportedProductImageFile({ name: 'design.svg', type: 'image/svg+xml' })).toBe(false);
  });
});
