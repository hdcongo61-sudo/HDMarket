import { describe, it, expect } from 'vitest';
import { editorOutputToFile } from './editorExport';
describe('studio exports', () => {
  it.each([['png', 'png'], ['jpeg', 'jpg'], ['webp', 'webp']])('preserves %s format and encoded bytes', async (mime, extension) => {
    const file = editorOutputToFile({ imageBase64: `data:image/${mime};base64,AQID`, fullName: 'photo.png' });
    expect(file.type).toBe(`image/${mime}`);
    expect(file.name).toBe(`photo-retouche.${extension}`);
    expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3]);
  });
  it('rejects remote URLs and invalid exports', () => {
    expect(() => editorOutputToFile({ imageBase64: 'https://example.com/image.png' })).toThrow();
    expect(() => editorOutputToFile({ imageBase64: 'data:text/html;base64,AQID' })).toThrow();
    expect(() => editorOutputToFile({})).toThrow();
  });
  it('uses the original filename as fallback', () => {
    expect(editorOutputToFile({ imageBase64: 'data:image/webp;base64,AQID' }, 'robe.jpg').name).toBe('robe-retouche.webp');
  });
});
