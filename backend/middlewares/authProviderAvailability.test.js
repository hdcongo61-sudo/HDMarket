import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getRuntimeConfig } = vi.hoisted(() => ({ getRuntimeConfig: vi.fn() }));
vi.mock('../services/configService.js', () => ({ getRuntimeConfig }));

const { requireAuthProvider } = await import('./authProviderAvailability.js');

describe('requireAuthProvider', () => {
  beforeEach(() => getRuntimeConfig.mockReset());

  it('continues when the method is enabled', async () => {
    getRuntimeConfig.mockResolvedValue(true);
    const next = vi.fn();
    await requireAuthProvider('auth_google_login_enabled', 'La connexion avec Google')({}, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when the method is disabled', async () => {
    getRuntimeConfig.mockResolvedValue(false);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();
    await requireAuthProvider('auth_google_login_enabled', 'La connexion avec Google')({}, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_PROVIDER_DISABLED' }));
    expect(next).not.toHaveBeenCalled();
  });
});
