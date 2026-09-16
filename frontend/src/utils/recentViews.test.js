import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/api', () => ({ default: { post: vi.fn(() => Promise.resolve()) } }));
import { loadRecentProductViews, saveRecentProductViews, setRecentViewsUser, recordProductView } from './recentViews';
beforeEach(() => {
  const store = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) } });
  setRecentViewsUser(null);
});
afterEach(() => vi.unstubAllGlobals());
describe('account-scoped history', () => {
  it('separates guest and account histories', () => {
    saveRecentProductViews([{ id: 'guest' }]);
    setRecentViewsUser('alice');
    expect(loadRecentProductViews()).toEqual([]);
    recordProductView({ _id: 'a', category: 'Mode' });
    setRecentViewsUser('bob');
    expect(loadRecentProductViews()).toEqual([]);
    expect(loadRecentProductViews('alice')[0].id).toBe('a');
    expect(loadRecentProductViews(null)).toEqual([{ id: 'guest' }]);
  });
  it('does not import legacy history of unknown ownership', () => {
    window.localStorage.setItem('hdmarket:recent-product-views', JSON.stringify([{ id: 'private' }]));
    expect(loadRecentProductViews()).toEqual([]);
    expect(loadRecentProductViews('alice')).toEqual([]);
  });
  it('handles blocked storage', () => {
    window.localStorage.getItem = () => { throw new Error('blocked'); };
    window.localStorage.setItem = () => { throw new Error('blocked'); };
    expect(loadRecentProductViews()).toEqual([]);
    expect(() => saveRecentProductViews([])).not.toThrow();
  });
});
