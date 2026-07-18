import { describe, expect, it } from 'vitest';
import { toClientError } from './globalErrorHandler.js';

describe('global error mapping', () => {
  it('preserves an unavailable Image Studio capability as 503', () => {
    const error = new Error('Ce traitement intelligent n’est pas encore activé sur ce serveur HDMarket.');
    error.statusCode = 503;
    error.code = 'IMAGE_STUDIO_CAPABILITY_UNAVAILABLE';

    expect(toClientError(error)).toEqual({
      status: 503,
      code: 'IMAGE_STUDIO_CAPABILITY_UNAVAILABLE',
      message: error.message,
      expose: true
    });
  });

  it('returns a safe message for an unknown upstream failure', () => {
    const error = new Error('provider secret details');
    error.statusCode = 502;

    expect(toClientError(error)).toMatchObject({
      status: 502,
      code: 'UPSTREAM_SERVICE_ERROR',
      expose: true
    });
    expect(toClientError(error).message).not.toContain('secret');
  });
});
