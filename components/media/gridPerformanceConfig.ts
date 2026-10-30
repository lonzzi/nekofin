/** FlatList with numColumns counts rows, so its default ten items mount ten full rows. */
export function getMediaGridListConfig({
  viewportHeight,
  rowHeight,
  numColumns = 1,
  renderAheadReady = true,
}: {
  viewportHeight: number;
  rowHeight: number;
  numColumns?: number;
  renderAheadReady?: boolean;
}) {
  const visibleRows =
    Number.isFinite(viewportHeight) &&
    viewportHeight > 0 &&
    Number.isFinite(rowHeight) &&
    rowHeight > 0
      ? Math.ceil(viewportHeight / rowHeight)
      : 0;

  // A tablet row can contain six or eight native image/menu trees. Budget by
  // cards, not rows, and populate offscreen rows after the visible viewport.
  const columns = Number.isFinite(numColumns) && numColumns > 0 ? numColumns : 1;
  return {
    initialNumToRender: Math.max(1, visibleRows + (columns <= 3 ? 1 : 0)),
    maxToRenderPerBatch: Math.max(1, Math.min(2, Math.floor(6 / columns))),
    updateCellsBatchingPeriod: 32,
    windowSize: renderAheadReady ? 5 : 1,
  } as const;
}
