import { describe, expect, it } from 'vitest';
import { startVideoWatch, stopVideoWatch } from './videoWatchTracker';

describe('actual video watch time', () => {
  const tracker = () => ({ startedAt: null, watchedMs: 0 });
  it('does not count rejected autoplay or time before playback', () => {
    const state = tracker();
    stopVideoWatch(state, 5000);
    expect(state.watchedMs).toBe(0);
  });
  it('excludes paused and buffering intervals', () => {
    const state = tracker();
    startVideoWatch(state, 0);
    stopVideoWatch(state, 1000);
    startVideoWatch(state, 9000);
    stopVideoWatch(state, 9500);
    expect(state.watchedMs).toBe(1500);
  });
  it('does not double count repeated stop events', () => {
    const state = tracker();
    startVideoWatch(state, 100);
    stopVideoWatch(state, 600);
    stopVideoWatch(state, 1000);
    expect(state.watchedMs).toBe(500);
  });
  it('does not restart a segment on repeated playing events', () => {
    const state = tracker();
    startVideoWatch(state, 100);
    startVideoWatch(state, 300);
    stopVideoWatch(state, 600);
    expect(state.watchedMs).toBe(500);
  });
});
