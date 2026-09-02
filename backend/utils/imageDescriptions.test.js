import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_DESCRIPTION_LENGTH,
  normalizeImageDescriptions,
  removeDescriptionsForImages
} from './imageDescriptions.js';

describe('image descriptions', () => {
  it('parses multipart JSON and keeps one description per image', () => {
    expect(normalizeImageDescriptions('[" Face avant ","Dos"]', 3)).toEqual([
      'Face avant',
      'Dos',
      ''
    ]);
  });

  it('limits descriptions and ignores entries beyond the image count', () => {
    expect(normalizeImageDescriptions(['x'.repeat(600), 'unused'], 1)).toEqual([
      'x'.repeat(MAX_IMAGE_DESCRIPTION_LENGTH)
    ]);
  });

  it('removes the matching description when an image is removed', () => {
    expect(
      removeDescriptionsForImages(
        ['one.jpg', 'two.jpg', 'three.jpg'],
        ['Première', 'Deuxième', 'Troisième'],
        new Set(['two.jpg'])
      )
    ).toEqual(['Première', 'Troisième']);
  });
});
