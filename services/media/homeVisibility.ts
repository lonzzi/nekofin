import type { QueryClient } from '@tanstack/react-query';

import { mediaQueryKeys } from './queryKeys';
import type { MediaAdapter, MediaItem, MediaPage, MediaServerInfo } from './types';

export type HomeLibraryScope = {
  libraryIds: string[];
  queryClient: QueryClient;
};

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Home request cancelled');
}

export function visibleHomeLibraryIds(items: MediaItem[] | undefined, hiddenIds: string[] = []) {
  const hidden = new Set(hiddenIds);
  return [
    ...new Set((items ?? []).flatMap((item) => (item.id && !hidden.has(item.id) ? [item.id] : []))),
  ].sort();
}

/** Preserve server watch order while checking the complete directory ancestry. */
async function visibleItems(
  items: MediaItem[],
  adapter: Pick<MediaAdapter, 'getItemAncestors'>,
  server: MediaServerInfo,
  { libraryIds, queryClient }: HomeLibraryScope,
  signal?: AbortSignal,
) {
  const allowed = new Set(libraryIds);
  const visible = new Array<boolean>(items.length).fill(false);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, items.length) }, async () => {
      while (next < items.length) {
        checkAbort(signal);
        const index = next++;
        const item = items[index];
        if (!item.id) continue;
        if (item.parentId && allowed.has(item.parentId)) {
          visible[index] = true;
          continue;
        }
        // Episodes of one series share ancestry. QueryClient also coalesces the
        // concurrent resume/next-up lookups and keeps this small cache off disk.
        const ancestorId = item.seriesId || item.parentId || item.id;
        const ancestors = await queryClient.fetchQuery({
          queryKey: mediaQueryKeys.homeItemAncestors(server.id, ancestorId),
          queryFn: () => adapter.getItemAncestors({ userId: server.userId, itemId: ancestorId }),
          staleTime: 5 * 60_000,
          gcTime: 5 * 60_000,
          retry: false,
        });
        visible[index] =
          allowed.has(ancestorId) || ancestors.some((ancestor) => allowed.has(ancestor.id));
      }
    }),
  );
  return visible;
}

export type VisibleHomePage = { items: MediaItem[]; total: number; nextStartIndex?: number };

export function nextVisibleHomePage(lastPage: VisibleHomePage, pages: VisibleHomePage[]) {
  const signature = lastPage.items.map((item) => item.id).join('|');
  if (pages.slice(0, -1).some((page) => page.items.map((item) => item.id).join('|') === signature))
    return undefined;
  return lastPage.nextStartIndex;
}

/** Advance the raw server offset, filling holes left by hidden libraries. */
export async function fetchVisibleHomePage({
  adapter,
  server,
  scope,
  fetchPage,
  limit,
  startIndex = 0,
  signal,
}: {
  adapter: Pick<MediaAdapter, 'getItemAncestors'>;
  server: MediaServerInfo;
  scope: HomeLibraryScope;
  fetchPage: (startIndex: number, limit: number) => Promise<MediaPage<MediaItem>>;
  limit: number;
  startIndex?: number;
  signal?: AbortSignal;
}): Promise<VisibleHomePage> {
  if (!scope.libraryIds.length || !server.userId) return { items: [], total: 0 };
  const items: MediaItem[] = [];
  const seen = new Set<string>();
  const seenPages = new Set<string>();
  let offset = startIndex;
  while (true) {
    checkAbort(signal);
    const page = await fetchPage(offset, limit);
    if (!page.items.length) return { items, total: items.length };
    const signature = page.items.map((item) => item.id).join('|');
    // Some older providers ignore StartIndex; never loop on the same page.
    if (seenPages.has(signature)) return { items, total: items.length };
    seenPages.add(signature);
    const visible = await visibleItems(page.items, adapter, server, scope, signal);
    checkAbort(signal);
    const atEnd =
      page.total != null && page.total > 0
        ? offset + page.items.length >= page.total
        : page.items.length < limit;
    for (let index = 0; index < page.items.length; index++) {
      const item = page.items[index];
      if (!visible[index] || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
      if (items.length === limit) {
        const nextStartIndex =
          atEnd && index === page.items.length - 1 ? undefined : offset + index + 1;
        return { items, total: items.length, nextStartIndex };
      }
    }
    if (atEnd) return { items, total: items.length };
    offset += page.items.length;
  }
}
