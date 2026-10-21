/** FlatList with numColumns counts rows, so its default ten items mount ten full rows. */
export function getMediaGridListConfig({
  viewportHeight,
  rowHeight,
}: {
  viewportHeight: number;
  rowHeight: number;
}) {
  const visibleRows =
    Number.isFinite(viewportHeight) &&
    viewportHeight > 0 &&
    Number.isFinite(rowHeight) &&
    rowHeight > 0
      ? Math.ceil(viewportHeight / rowHeight)
      : 0;

  return {
    initialNumToRender: Math.max(1, visibleRows + 1),
    maxToRenderPerBatch: 2,
    updateCellsBatchingPeriod: 32,
    windowSize: 5,
  } as const;
}
