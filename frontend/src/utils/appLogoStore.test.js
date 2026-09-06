import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

const createStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
};

const createWindowStub = () => {
  const listeners = new Map();
  return {
    localStorage: createStorage(),
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: (name) => listeners.delete(name),
    dispatch: (name, event) => {
      const cb = listeners.get(name);
      if (cb) cb(event);
    }
  };
};

const loadStore = async () => {
  vi.resetModules();
  const { default: api } = await import('../services/api');
  const store = await import('./appLogoStore');
  return { api, store };
};

const PAYLOAD = {
  appLogoDesktop: 'https://cdn.example.com/logo-desktop.png',
  appLogoMobile: 'https://cdn.example.com/logo-mobile.png',
  authLogo: 'https://cdn.example.com/logo-auth.png',
  appIcon: 'https://cdn.example.com/icon.png',
  appFavicon: 'https://cdn.example.com/favicon.ico'
};

describe('appLogoStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete globalThis.window;
  });

  it('shares a single network request between concurrent callers', async () => {
    globalThis.window = createWindowStub();
    const { api, store } = await loadStore();
    api.get.mockResolvedValue({ data: { ...PAYLOAD } });

    const [first, second] = await Promise.all([
      store.fetchAppLogo(),
      store.fetchAppLogo()
    ]);

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(first).toEqual(PAYLOAD);
    expect(second).toEqual(PAYLOAD);
  });

  it('reuses the cached payload within the TTL without hitting the network', async () => {
    globalThis.window = createWindowStub();
    const { api, store } = await loadStore();
    api.get.mockResolvedValue({ data: { ...PAYLOAD } });

    await store.fetchAppLogo();
    const second = await store.fetchAppLogo();

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(second).toEqual(PAYLOAD);
    expect(store.getCachedAppLogo()).toEqual(PAYLOAD);
  });

  it('force bypasses the TTL and refetches', async () => {
    globalThis.window = createWindowStub();
    const { api, store } = await loadStore();
    api.get.mockResolvedValue({ data: { ...PAYLOAD } });

    await store.fetchAppLogo();
    await store.fetchAppLogo({ force: true });

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('serves the last known payload when the network fails', async () => {
    globalThis.window = createWindowStub();
    const { api, store } = await loadStore();
    api.get.mockResolvedValueOnce({ data: { ...PAYLOAD } });
    await store.fetchAppLogo();

    api.get.mockRejectedValue(new Error('offline'));
    const result = await store.fetchAppLogo({ force: true });

    expect(result).toEqual(PAYLOAD);
  });

  it('resolves null when nothing is known and the network fails', async () => {
    globalThis.window = createWindowStub();
    const { api, store } = await loadStore();
    api.get.mockRejectedValue(new Error('offline'));

    await expect(store.fetchAppLogo()).resolves.toBeNull();
  });

  it('hydrates from localStorage on module load', async () => {
    const windowStub = createWindowStub();
    windowStub.localStorage.setItem(
      'hdmarket:app-logo-store',
      JSON.stringify({ ts: Date.now(), payload: PAYLOAD })
    );
    globalThis.window = windowStub;

    const { api, store } = await loadStore();

    expect(store.getCachedAppLogo()).toEqual(PAYLOAD);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('merges the admin app-logo-updated event into the cache', async () => {
    const windowStub = createWindowStub();
    globalThis.window = windowStub;
    const { api, store } = await loadStore();
    api.get.mockResolvedValue({ data: { ...PAYLOAD } });
    await store.fetchAppLogo();

    windowStub.dispatch('hdmarket:app-logo-updated', {
      detail: { appLogoDesktop: 'https://cdn.example.com/new-logo.png' }
    });

    expect(store.getCachedAppLogo()?.appLogoDesktop).toBe('https://cdn.example.com/new-logo.png');
    expect(store.getCachedAppLogo()?.appIcon).toBe(PAYLOAD.appIcon);
  });
});
