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

describe('profile shop color validation', () => {
  it('preserves and normalizes a valid shop color', () => {
    const { error, value } = schemas.profileUpdate.validate(
      { shopColor: '#2f6fed' },
      { stripUnknown: true }
    );

    expect(error).toBeUndefined();
    expect(value.shopColor).toBe('#2F6FED');
  });

  it('rejects an invalid shop color', () => {
    const { error } = schemas.profileUpdate.validate({ shopColor: 'violet' });

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('#RRGGBB');
  });
});
