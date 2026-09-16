import { describe, it, expect } from 'vitest';
import { preserveEditorResolution, sourceCacheRatio } from './editorResolution';

describe('full-resolution editor cache', () => {
  const node = { image: () => ({ naturalWidth: 4000, naturalHeight: 3000 }), width: () => 800, height: () => 600 };
  it('keeps source pixels even on a small preview', () => {
    expect(sourceCacheRatio(node)).toBe(5);
    expect(sourceCacheRatio({ ...node, width: () => 400, height: () => 300 })).toBe(10);
    expect(sourceCacheRatio(node, 6)).toBe(6);
  });
  it('only changes the editor image cache and restores the original method', () => {
    class Image {
      cache(config) { return config; }
      id() { return 'FIE_original-image'; }
      image = node.image;
      width = node.width;
      height = node.height;
    }
    const original = Image.prototype.cache;
    const cleanup = preserveEditorResolution({ Image });
    expect(new Image().cache({ offset: 2 })).toEqual({ offset: 2, pixelRatio: 5 });
    const other = new Image(); other.id = () => 'another-image';
    expect(other.cache({ pixelRatio: 1 })).toEqual({ pixelRatio: 1 });
    cleanup();
    expect(Image.prototype.cache).toBe(original);
  });
});
