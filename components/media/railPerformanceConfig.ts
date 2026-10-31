/** Render the visible horizontal cards plus one, then mount small batches as needed. */
export function getMediaRailListConfig({
  gap,
  horizontalPadding,
  cardWidth,
  viewportWidth,
}: {
  gap: number;
  horizontalPadding: number;
  cardWidth: number;
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

  const itemStride = cardWidth + safeGap;
  const visibleItemCount = Math.max(1, Math.ceil((contentWidth + safeGap) / itemStride));
  const initialNumToRender = visibleItemCount + 1;

  return {
    initialNumToRender,
    // Wide screens need a full initial viewport, but replenishing an entire
    // tablet row at once can block JS for hundreds of milliseconds.
    maxToRenderPerBatch: Math.min(3, initialNumToRender),
    windowSize: 3,
  } as const;
}
