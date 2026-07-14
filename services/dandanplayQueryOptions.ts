import { queryOptions } from '@tanstack/react-query';

import type { DandanComment } from './dandanplay';
import { mediaQueryKeys } from './media/queryKeys';
import type { MediaItem } from './media/types';

export type DandanplayCommentsData = {
  comments: DandanComment[];
  episodeInfo?: { animeTitle: string; episodeTitle: string };
};

export function dandanplayCommentsQueryOptions({
  serverId,
  item,
  originalTitle,
  useManualComments,
  fetchComments,
}: {
  serverId: string | null | undefined;
  item: MediaItem | null | undefined;
  originalTitle: string | null | undefined;
  useManualComments: boolean;
  fetchComments: (
    item: MediaItem,
    originalTitle?: string | null,
  ) => Promise<DandanplayCommentsData | undefined>;
}) {
  return queryOptions({
    enabled: !!item && !!(item.seriesName?.trim() || originalTitle?.trim()) && !useManualComments,
    queryKey: mediaQueryKeys.comments(serverId, item?.id, originalTitle),
    queryFn: async () => {
      if (!item) {
        return { comments: [], episodeInfo: undefined };
      }
      return (await fetchComments(item, originalTitle)) ?? { comments: [], episodeInfo: undefined };
    },
    staleTime: 1000 * 60 * 5,
  });
}
