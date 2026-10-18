import { describe, expect, it } from 'vitest';

import {
  resolveGridLayout,
  resolveTabletChrome,
  usesAndroidNavigationRail,
} from './adaptiveLayout';

describe('Android adaptive navigation', () => {
  it('uses a rail on portrait and landscape tablet windows', () => {
    expect(usesAndroidNavigationRail(600, 960)).toBe(true);
    expect(usesAndroidNavigationRail(1280, 800)).toBe(true);
  });

  it('restores bottom navigation in narrow split windows and short landscape windows', () => {
    expect(usesAndroidNavigationRail(599, 960)).toBe(false);
    expect(usesAndroidNavigationRail(960, 479)).toBe(false);
    expect(usesAndroidNavigationRail(840, 480)).toBe(true);
  });
});

describe('floating tablet chrome', () => {
  const insets = { top: 24, bottom: 24, left: 0, right: 0 };
  const chrome = (width: number) => resolveTabletChrome({ width, insets });

  it('keeps the navigator full width behind a fixed floating sidebar', () => {
    expect(chrome(1280)).toMatchObject({
      sidebarWidth: 320,
      paneWidth: 1280,
      tabsWidth: 312,
      textTabsWidth: 268,
      clusterWidth: 356,
      sidebarToggleWidth: 44,
      tabsHeight: 44,
      toolbarHeight: 64,
      tabsOffset: 0,
    });
    for (const width of [600, 800, 920, 1280]) {
      expect(chrome(width).paneWidth).toBe(width);
      expect(chrome(width).sidebarWidth).toBe(320);
      expect(chrome(width).tabsOffset).toBe(0);
    }
  });

  it('fits four text tabs and an icon search tab inside one capsule between toolbar groups', () => {
    const layout = chrome(600);
    expect(layout.paneWidth).toBe(600);
    expect(layout.textTabsWidth).toBeGreaterThanOrEqual(4 * 48);
    expect(layout.searchWidth).toBe(44);
    expect(layout.tabsWidth).toBe(layout.textTabsWidth + layout.searchWidth);
    expect(layout.clusterWidth).toBe(layout.sidebarToggleWidth + layout.tabsWidth);
    expect((600 - layout.clusterWidth) / 2).toBeGreaterThanOrEqual(128);
  });

  it('centers within the safe content pane with asymmetric cutouts', () => {
    const layout = resolveTabletChrome({
      width: 800,
      insets: { ...insets, left: 30, right: 10 },
    });
    expect(layout.tabsOffset).toBe(10);
  });
});

describe('adaptive media grid', () => {
  const grid = (width: number, minItemWidth?: number) =>
    resolveGridLayout({ width, gap: 12, horizontalPadding: 16, type: 'series', minItemWidth });

  it('uses the full tablet viewport underneath the floating sidebar', () => {
    const width = 1280;
    const { numColumns, itemWidth, gap } = grid(width);
    expect(numColumns).toBe(6);
    expect(numColumns * itemWidth + (numColumns - 1) * gap + 32).toBeCloseTo(width);
    expect(itemWidth).toBeGreaterThanOrEqual(180);
  });

  it('preserves phone poster density and adapts to a narrow split', () => {
    expect(grid(393).numColumns).toBe(3);
    expect(grid(393, 160).numColumns).toBe(2);
    expect(grid(280, 160).numColumns).toBe(1);
    expect(grid(0).itemWidth).toBeGreaterThan(0);
  });

  it('counts gaps before adding another tablet column and respects minimum card widths', () => {
    expect(grid(600).numColumns).toBe(3);
    expect(grid(1000, 300).numColumns).toBe(3);
    expect(grid(3000).numColumns).toBe(8);
  });
});
