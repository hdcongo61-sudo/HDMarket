import { describe, expect, it } from 'vitest';
import { schemas } from './validate.js';

describe('product Image Studio validation', () => {
  it('preserves valid image replacement metadata on update', () => {
    const payload = {
      newImageStudioMetadata: '[]',
      imageReplacementTargets: '["https://res.cloudinary.com/demo/image/upload/product.webp"]',
      imageStudioMetadata: '[{"qualityScore":91}]',
      removeImages: [
        'https://example.com/1.webp',
        'https://example.com/2.webp',
        'https://example.com/3.webp',
        'https://example.com/4.webp'
      ]
    };

    const { error, value } = schemas.productUpdate.validate(payload, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value).toEqual(payload);
  });

  it('rejects malformed Image Studio metadata', () => {
    const { error } = schemas.productUpdate.validate({ imageReplacementTargets: '{bad-json' });
    expect(error).toBeDefined();
  });
});
