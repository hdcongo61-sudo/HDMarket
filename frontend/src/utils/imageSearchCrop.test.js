import { describe, expect, it } from 'vitest';
import { imageSearchCrop } from './imageSearchCrop';
describe('photo search framing', () => {
  it('centers a square in a landscape photo', () => expect(imageSearchCrop(1200, 800)).toEqual({ sx: 200, sy: 0, size: 800 }));
  it('zooms and moves to the bottom right without leaving the image', () => expect(imageSearchCrop(1200, 800, { zoom: 2, x: 100, y: 100 })).toEqual({ sx: 800, sy: 400, size: 400 }));
  it('bounds malformed controls', () => expect(imageSearchCrop(800, 800, { zoom: -1, x: 1000, y: -10 })).toEqual({ sx: 0, sy: 0, size: 800 }));
});
