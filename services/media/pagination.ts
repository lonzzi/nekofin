export type InfiniteMediaPage<T> = {
  items: T[];
  total: number;
};

export function getNextMediaPageParam<T>(
  lastPage: InfiniteMediaPage<T>,
  allPages: InfiniteMediaPage<T>[],
) {
  const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
  return loaded >= lastPage.total || lastPage.items.length === 0 ? undefined : loaded;
}
