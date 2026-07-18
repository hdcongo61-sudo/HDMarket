import { describe, expect, it } from 'vitest';
import {
  applyPreset,
  applySmartOptimization,
  createHistoryState,
  createInitialImageStudioState,
  getCanvasFilter,
  historyReducer
} from './imageStudioState';

describe('Image Studio state', () => {
  it('keeps edits non-destructive through undo and redo', () => {
    const initial = createInitialImageStudioState();
    const changed = historyReducer(createHistoryState(initial), {
      type: 'CHANGE',
      payload: (state) => ({ ...state, rotation: 90 })
    });
    expect(changed.present.rotation).toBe(90);
    const undone = historyReducer(changed, { type: 'UNDO' });
    expect(undone.present.rotation).toBe(0);
    expect(historyReducer(undone, { type: 'REDO' }).present.rotation).toBe(90);
  });

  it('applies editable professional presets', () => {
    const state = applyPreset(createInitialImageStudioState(), 'Studio');
    expect(state.preset).toBe('Studio');
    expect(state.adjustments.sharpness).toBeGreaterThan(0);
    expect(getCanvasFilter(state.adjustments)).toContain('contrast(');
  });

  it('optimizes for HDMarket with WEBP and square output', () => {
    const state = applySmartOptimization(createInitialImageStudioState(), 'Maison Congo');
    expect(state.aspectRatio).toBe('1:1');
    expect(state.output.format).toBe('image/webp');
    expect(state.watermark.text).toBe('Maison Congo');
    expect(state.aiOperations).toContain('smart-crop');
  });
});
