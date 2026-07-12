const HOME_RAIL_CARD_WIDTHS = {
  episode: 220,
  series: 120,
  userView: 200,
} as const;

export type HomeRailType = keyof typeof HOME_RAIL_CARD_WIDTHS;

export function getHomeRailListConfig({
  gap,
  horizontalPadding,
  type,
  viewportWidth,
}: {
  gap: number;
  horizontalPadding: number;
  type: HomeRailType;
  viewportWidth: number;
}) {
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  const safePadding = Number.isFinite(horizontalPadding) ? Math.max(0, horizontalPadding) : 0;
  const contentWidth = viewportWidth - safePadding * 2;

  if (!Number.isFinite(contentWidth) || contentWidth <= 0) {
    return {
      initialNumToRender: 1,
      maxToRenderPerBatch: 1,
      windowSize: 3,
    } as const;
  }

  const itemStride = HOME_RAIL_CARD_WIDTHS[type] + safeGap;
  const visibleItemCount = Math.max(1, Math.ceil((contentWidth + safeGap) / itemStride));
  const initialNumToRender = visibleItemCount + 1;

  return {
    initialNumToRender,
    maxToRenderPerBatch: initialNumToRender,
    windowSize: 3,
  } as const;
}

export const HOME_CAROUSEL_IMAGE_WIDTHS = {
  atmosphere: 160,
  hero: 1000,
} as const;
