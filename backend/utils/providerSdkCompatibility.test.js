import { afterEach, describe, expect, it, vi } from 'vitest';
import https from 'node:https';
import { Writable, Readable } from 'node:stream';
import nodemailer from 'nodemailer';
import cloudinary from './cloudinary.js';
import { uploadToCloudinary } from './cloudinaryUploader.js';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); cloudinary.config(true); });
describe('upgraded provider SDK compatibility without external requests', () => {
  it.each(['image', 'video'])('streams %s uploads through the upgraded Cloudinary SDK', async resourceType => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-secret');
    cloudinary.config({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: 'test-secret' });
    const chunks = [];
    const request = vi.spyOn(https, 'request').mockImplementation((options, callback) => {
      const output = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
      output.setTimeout = vi.fn();
      output.on('finish', () => {
        const response = Readable.from([JSON.stringify({ public_id: 'fixture', secure_url: 'https://example.invalid/fixture', resource_type: resourceType })]);
        response.statusCode = 200;
        callback(response);
      });
      return output;
    });
    const result = await uploadToCloudinary({ buffer: Buffer.from('test-media'), resourceType, folder: 'hdmarket/test', options: { public_id: 'fixture' } });
    expect(result.public_id).toBe('fixture');
    expect(request.mock.calls[0][0].path).toContain(`/v1_1/test-cloud/${resourceType}/upload`);
    expect(Buffer.concat(chunks).toString()).toContain('test-media');
    expect(Buffer.concat(chunks).toString()).toContain('hdmarket/test');
  });
  it('composes password-reset mail without sending it', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({ from: 'HDMarket <test@example.invalid>', to: 'buyer@example.invalid', subject: 'Réinitialisation de mot de passe - HDMarket', html: '<a href="https://example.invalid/reset-password?token=test">Réinitialiser</a>' });
    expect(result.envelope.to).toEqual(['buyer@example.invalid']);
    expect(result.message.toString().replace(/=\r\n/g, '').replace(/=3D/g, '=')).toContain('reset-password?token=test');
    transport.close();
  });
});
