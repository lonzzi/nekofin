import type { MediaAdapter, MediaItem, MediaServerInfo } from '@/services/media/types';

export type MediaItemSource = { server: MediaServerInfo; adapter: MediaAdapter };
export type GetMediaItemSource = (item: MediaItem) => MediaItemSource | undefined;

export function getSourcedMediaKey(item: MediaItem, source?: MediaItemSource) {
  return source ? `${source.server.id}:${item.id}` : item.id!;
}
