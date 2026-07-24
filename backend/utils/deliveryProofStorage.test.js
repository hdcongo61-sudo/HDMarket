import { afterEach, describe, expect, it } from 'vitest';
import { persistDeliveryProofFile } from './deliveryProofStorage.js';

const originalCloudinaryEnv = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET
};

afterEach(() => {
  const restore = (key, value) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore('CLOUDINARY_CLOUD_NAME', originalCloudinaryEnv.cloudName);
  restore('CLOUDINARY_API_KEY', originalCloudinaryEnv.apiKey);
  restore('CLOUDINARY_API_SECRET', originalCloudinaryEnv.apiSecret);
});

describe('delivery proof storage', () => {
  it('keeps a local URL as a development fallback when managed storage is unavailable', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(
      persistDeliveryProofFile({ filename: 'proof.jpg' })
    ).resolves.toBe('uploads/delivery-proofs/proof.jpg');
  });

  it('returns an empty URL when no file was submitted', async () => {
    await expect(persistDeliveryProofFile(null)).resolves.toBe('');
  });
});
