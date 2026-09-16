import { describe, expect, it } from 'vitest';
import zlib from 'zlib';
import { isCloudinaryUrl, decodePngColor, normalizeInputColor } from './visualSearchService.js';
const chunk = (type, data) => {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); out.write(type, 4); data.copy(out, 8); return out;
};
const png = (width = 1) => {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 12, 34, 56]))), chunk('IEND', Buffer.alloc(0))]);
};
describe('visual search input and decoding', () => {
  it('allows only actual HTTPS Cloudinary image hosts', () => {
    expect(isCloudinaryUrl('https://res.cloudinary.com/shop/image/upload/v1/a.jpg')).toBe(true);
    for (const value of ['https://evil.test/res.cloudinary.com/image/upload/a', 'http://res.cloudinary.com/shop/image/upload/a', 'https://res.cloudinary.com.evil.test/image/upload/a', 'https://user@res.cloudinary.com/shop/image/upload/a']) expect(isCloudinaryUrl(value)).toBe(false);
  });
  it('requires exactly three numeric RGB components', () => {
    expect(normalizeInputColor([12, 34, 56])).toEqual({ r: 12, g: 34, b: 56 });
    for (const value of [[null, 0, 0], [256, 0, 0], [1, 2], [1, 2, 3, 4], ['1', 2, 3]]) expect(normalizeInputColor(value)).toBeNull();
  });
  it('decodes a one-pixel PNG', () => expect(decodePngColor(png())).toEqual({ r: 12, g: 34, b: 56 }));
  it('rejects unexpected dimensions and truncated chunks without throwing', () => {
    expect(decodePngColor(png(100000))).toBeNull();
    expect(decodePngColor(png().subarray(0, 35))).toBeNull();
  });
});
