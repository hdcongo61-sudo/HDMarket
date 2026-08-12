import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRouteViewCache,
  readRouteViewCache,
  writeRouteViewCache
} from './routeViewCache';

const createStorage = () => {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
};

describe('route view offline cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T10:00:00Z'));
    const localStorage = createStorage();
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('navigator', { onLine: true });
    clearRouteViewCache();
  });

  afterEach(() => {
    clearRouteViewCache();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('persists a view and reads it normally while fresh', () => {
    writeRouteViewCache('products:test', { items: [{ id: 'p1' }] });
    expect(readRouteViewCache('products:test')).toEqual({ items: [{ id: 'p1' }] });
    expect(window.localStorage.length).toBe(1);
  });

  it('keeps an expired online view available as an offline fallback', () => {
    writeRouteViewCache('home:test', { items: [{ id: 'p1' }] });
    vi.advanceTimersByTime(20 * 60 * 1000);

    expect(readRouteViewCache('home:test')).toBeNull();

    navigator.onLine = false;
    expect(readRouteViewCache('home:test')).toEqual({ items: [{ id: 'p1' }] });
  });

  it('drops offline snapshots older than seven days', () => {
    writeRouteViewCache('shops:test', { items: [{ id: 's1' }] });
    navigator.onLine = false;
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    expect(readRouteViewCache('shops:test')).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});
