import { describe, expect, it } from 'vitest';

import { getHomeRailListConfig, HOME_CAROUSEL_IMAGE_WIDTHS } from './homePerformanceConfig';

describe('home performance configuration', () => {
  it('renders the visible phone items plus one while keeping a small window', () => {
    const baseInput = {
      gap: 16,
      horizontalPadding: 20,
      viewportWidth: 390,
    };

    expect(getHomeRailListConfig({ ...baseInput, type: 'episode' })).toEqual({
      initialNumToRender: 3,
      maxToRenderPerBatch: 3,
      windowSize: 3,
    });
    expect(getHomeRailListConfig({ ...baseInput, type: 'series' })).toEqual({
      initialNumToRender: 4,
      maxToRenderPerBatch: 4,
      windowSize: 3,
    });
    expect(getHomeRailListConfig({ ...baseInput, type: 'userView' })).toEqual({
      initialNumToRender: 3,
      maxToRenderPerBatch: 3,
      windowSize: 3,
    });
  });

  it('scales the initial rail batch to fill an iPad viewport', () => {
    const baseInput = {
      gap: 16,
      horizontalPadding: 20,
      viewportWidth: 1024,
    };

    expect(getHomeRailListConfig({ ...baseInput, type: 'episode' }).initialNumToRender).toBe(6);
    expect(getHomeRailListConfig({ ...baseInput, type: 'series' }).initialNumToRender).toBe(9);
    expect(getHomeRailListConfig({ ...baseInput, type: 'userView' }).initialNumToRender).toBe(6);
  });

  it('falls back to one item before a valid viewport is available', () => {
    expect(
      getHomeRailListConfig({
        gap: Number.NaN,
        horizontalPadding: Number.NaN,
        type: 'episode',
        viewportWidth: 0,
      }),
    ).toEqual({
      initialNumToRender: 1,
      maxToRenderPerBatch: 1,
      windowSize: 3,
    });
  });

  it('uses a small atmosphere texture while preserving hero image detail', () => {
    expect(HOME_CAROUSEL_IMAGE_WIDTHS).toEqual({
      atmosphere: 160,
      hero: 1000,
    });
  });
});
