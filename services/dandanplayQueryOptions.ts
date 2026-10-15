import { queryOptions } from '@tanstack/react-query';

import type { DanmakuCommentsData } from './danmaku';
import { mediaQueryKeys } from './media/queryKeys';
import type { MediaItem } from './media/types';

export type DandanplayCommentsData = DanmakuCommentsData;

export function dandanplayCommentsQueryOptions({
  serverId,
  item,
  originalTitle,
  useManualComments,
  fetchComments,
  sourcesKey,
  enabled = true,
}: {
  serverId: string | null | undefined;
  item: MediaItem | null | undefined;
  originalTitle: string | null | undefined;
  useManualComments: boolean;
  sourcesKey?: string;
  enabled?: boolean;
  fetchComments: (
    item: MediaItem,
    originalTitle?: string | null,
    signal?: AbortSignal,
  ) => Promise<DandanplayCommentsData | undefined>;
}) {
  return queryOptions({
    enabled:
      enabled &&
      !!item &&
      !!(
        item.seriesName?.trim() ||
        originalTitle?.trim() ||
        (item.type === 'Movie' && item.name?.trim())
      ) &&
      !useManualComments,
    queryKey: [
      ...mediaQueryKeys.comments(serverId, item?.id, originalTitle),
      ...(sourcesKey === undefined ? [] : [sourcesKey]),
    ],
    queryFn: async ({ signal }) => {
      if (!item) {
        return { comments: [], episodeInfo: undefined };
      }
      return (
        (await (signal
          ? fetchComments(item, originalTitle, signal)
          : fetchComments(item, originalTitle))) ?? { comments: [], episodeInfo: undefined }
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}
