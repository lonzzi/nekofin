import type { ImageUrlInfo } from '@/lib/utils/image';
import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { mediaQueryKeys } from './queryKeys';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

export type DetailArtwork = {
  header: ImageUrlInfo;
  atmosphere: ImageUrlInfo;
};

export function getDetailArtwork(adapter: MediaAdapter, item: MediaItem): DetailArtwork {
  // Episode selection uses the episode's own still. Use that same choice on the
  // first render instead of briefly loading the parent series backdrop first.
  const preferBackdrop = item.type !== 'Episode';
  const header = adapter.getImageInfo({ item, opts: { preferBackdrop, width: 1000 } });
  const atmosphere =
    item.type === 'Episode'
      ? header
      : adapter.getImageInfo({ item, opts: { preferBackdrop, width: 640 } });
  return { header, atmosphere };
}

export function detailArtworkQueryOptions(server: MediaServerInfo | null, itemId: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.detailArtwork(server?.id, server?.userId, itemId),
    // Navigation hands off artwork only; it must never mark a partial list item
    // as a fetched detail bundle or prevent the real detail request.
    queryFn: (): DetailArtwork | null => null,
    enabled: false,
    gcTime: 5 * 60 * 1000,
  });
}

export function rememberDetailArtwork({
  client,
  server,
  adapter,
  item,
  targetItemId,
}: {
  client: QueryClient;
  server: MediaServerInfo | null | undefined;
  adapter: MediaAdapter;
  item: MediaItem;
  targetItemId: string | undefined;
}) {
  if (!server?.id || !server.userId || !item.id || item.id !== targetItemId) return;
  const options = detailArtworkQueryOptions(server, item.id);
  client.setQueryData(options.queryKey, getDetailArtwork(adapter, item));
}
