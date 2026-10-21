import { describe, expect, it } from 'vitest';

import { getMediaGridListConfig } from './gridPerformanceConfig';

describe('media grid rendering budget', () => {
  it('covers a phone viewport with one spare poster row', () => {
    const config = getMediaGridListConfig({ viewportHeight: 780, rowHeight: 230 });
    expect(config.initialNumToRender).toBe(5);
    expect(config.initialNumToRender * 3).toBeLessThan(30);
  });

  it('does not mount ten entire tablet rows before the entrance animation', () => {
    const config = getMediaGridListConfig({ viewportHeight: 800, rowHeight: 340 });
    expect(config.initialNumToRender).toBe(4);
    expect(config.maxToRenderPerBatch).toBeLessThan(config.initialNumToRender);
  });

  it('covers the visible rows when episode cards are shorter', () => {
    const config = getMediaGridListConfig({ viewportHeight: 700, rowHeight: 170 });
    expect(config.initialNumToRender).toBe(6);
    expect((config.initialNumToRender - 1) * 170).toBeGreaterThanOrEqual(700);
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
