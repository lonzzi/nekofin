import { describe, expect, it } from 'vitest';

import { getMediaGridListConfig } from './gridPerformanceConfig';

describe('media grid rendering budget', () => {
  it('covers a phone viewport with one spare poster row', () => {
    const config = getMediaGridListConfig({ viewportHeight: 780, rowHeight: 230, numColumns: 3 });
    expect(config.initialNumToRender).toBe(5);
    expect(config.initialNumToRender * 3).toBeLessThan(30);
  });

  it('does not mount ten entire tablet rows before the entrance animation', () => {
    const config = getMediaGridListConfig({ viewportHeight: 800, rowHeight: 340, numColumns: 6 });
    expect(config.initialNumToRender * 340).toBeGreaterThanOrEqual(800);
    expect(config.initialNumToRender * 6).toBeLessThanOrEqual(18);
    expect(config.maxToRenderPerBatch * 6).toBeLessThanOrEqual(6);
  });

  it('covers the visible rows when episode cards are shorter', () => {
    const config = getMediaGridListConfig({ viewportHeight: 700, rowHeight: 170 });
    expect(config.initialNumToRender).toBe(6);
    expect((config.initialNumToRender - 1) * 170).toBeGreaterThanOrEqual(700);
  });

  it('keeps the visible tablet rows while delaying offscreen work until navigation finishes', () => {
    const dimensions = { viewportHeight: 800, rowHeight: 340, numColumns: 6 };
    const during = getMediaGridListConfig({ ...dimensions, renderAheadReady: false });
    const after = getMediaGridListConfig({ ...dimensions, renderAheadReady: true });
    expect(during.initialNumToRender * dimensions.rowHeight).toBeGreaterThanOrEqual(800);
    expect(during.initialNumToRender).toBe(after.initialNumToRender);
    expect(during.windowSize).toBe(1);
    expect(after.windowSize).toBeGreaterThan(during.windowSize);
  });

  it('adjusts the row budget when larger text increases card height', () => {
    const regular = getMediaGridListConfig({ viewportHeight: 780, rowHeight: 230 });
    const largeText = getMediaGridListConfig({ viewportHeight: 780, rowHeight: 310 });
    expect(largeText.initialNumToRender).toBeLessThan(regular.initialNumToRender);
    expect(largeText.initialNumToRender * 310).toBeGreaterThan(780);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'uses a minimal first batch for unmeasured dimensions (%s)',
    (dimension) => {
      expect(
        getMediaGridListConfig({ viewportHeight: dimension, rowHeight: 230 }).initialNumToRender,
      ).toBe(1);
      expect(
        getMediaGridListConfig({ viewportHeight: 780, rowHeight: dimension }).initialNumToRender,
      ).toBe(1);
    },
  );
});
