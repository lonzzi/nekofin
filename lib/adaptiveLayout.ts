import { NAVIGATION_CONTROL_SIZE } from '@/lib/navigationMetrics';

export const TABLET_MIN_WIDTH = 600;
export const NAVIGATION_RAIL_WIDTH = 320;
export const TABLET_TAB_HEIGHT = NAVIGATION_CONTROL_SIZE;

/** Use the app window, which can shrink independently of the physical display. */
export function usesAndroidNavigationRail(width: number, height: number) {
  return width >= TABLET_MIN_WIDTH && height >= 480;
}

/** Keep the floating tabs between the native back/title and trailing toolbar actions. */
export function resolveTabletChrome({
  width,
  insets,
}: {
  width: number;
  insets: { top: number; bottom: number; left: number; right: number };
}) {
  const contentWidth = width - insets.left - insets.right;
  const searchWidth = TABLET_TAB_HEIGHT;
  const sidebarToggleWidth = TABLET_TAB_HEIGHT;
  // Reserve both native toolbar action groups, even in a 600dp split window.
  const textTabsWidth = Math.min(268, contentWidth - 128 * 2 - searchWidth - sidebarToggleWidth);
  const tabsWidth = textTabsWidth + searchWidth;
  const clusterWidth = sidebarToggleWidth + tabsWidth;
  const sideSpace = (contentWidth - clusterWidth) / 2;
  const leadingWidth = 0;
  const availableTitle = sideSpace - 64 - leadingWidth - 8;
  return {
    sidebarWidth: NAVIGATION_RAIL_WIDTH,
    // A floating sidebar never participates in the navigator's layout.
    paneWidth: width,
    tabsWidth,
    textTabsWidth,
    sidebarToggleWidth,
    clusterWidth,
    searchWidth,
    tabsHeight: TABLET_TAB_HEIGHT,
    toolbarHeight: TABLET_TAB_HEIGHT + 20,
    tabsOffset: (insets.left - insets.right) / 2,
    leadingWidth,
    titleMaxWidth: availableTitle >= 40 ? availableTitle : 0,
  };
}

export function resolveGridLayout({
  width,
  gap,
  horizontalPadding,
  type,
  minItemWidth = 0,
}: {
  width: number;
  gap: number;
  horizontalPadding: number;
  type?: 'series' | 'episode';
  minItemWidth?: number;
}) {
  const availableWidth = Math.max(1, width - horizontalPadding * 2);
  const large = width >= TABLET_MIN_WIDTH;
  const targetWidth = Math.max(type === 'series' ? (large ? 180 : 120) : 160, minItemWidth);
  // Preserve the compact poster density, while counting gutters on large grids.
  const columns = large
    ? Math.floor((availableWidth + gap) / (targetWidth + gap))
    : Math.floor(availableWidth / targetWidth);
  const numColumns = Math.max(1, Math.min(large ? 8 : 4, columns));
  return { numColumns, itemWidth: (availableWidth - (numColumns - 1) * gap) / numColumns, gap };
}
