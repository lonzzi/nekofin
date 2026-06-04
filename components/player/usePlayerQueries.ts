import { getCommentsByItem } from '@/lib/utils';
import { dandanplayCommentsQueryOptions } from '@/services/dandanplayQueryOptions';
import type { StreamInfoKeyOptions } from '@/services/media/queryKeys';
import {
  episodesBySeasonQueryOptions,
  itemDetailQueryOptions,
  streamInfoQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaAdapter, MediaServerInfo } from '@/services/media/types';
import { useQuery } from '@tanstack/react-query';

export function usePlayerQueries({
  itemId,
  mediaAdapter,
  currentServer,
  useManualComments,
  streamInfoKeyOptions,
  streamDeviceProfile,
  streamDeviceId,
}: {
  itemId: string;
  mediaAdapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  useManualComments: boolean;
  streamInfoKeyOptions: StreamInfoKeyOptions;
  streamDeviceProfile: unknown;
  streamDeviceId: string;
}) {
  const { data: itemDetail } = useQuery(
    itemDetailQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      itemId,
    }),
  );

  const { data: seriesInfo } = useQuery(
    itemDetailQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      itemId: itemDetail?.seriesId,
    }),
  );

  const { data: autoCommentsData } = useQuery(
    dandanplayCommentsQueryOptions({
      serverId: currentServer?.id,
      item: itemDetail,
      originalTitle: seriesInfo?.originalTitle,
      useManualComments,
      fetchComments: getCommentsByItem,
    }),
  );

  const { data: streamInfo } = useQuery(
    streamInfoQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      item: itemDetail,
      keyOptions: streamInfoKeyOptions,
      deviceProfile: streamDeviceProfile,
      deviceId: streamDeviceId,
    }),
  );

  const { data: episodes = [] } = useQuery(
    episodesBySeasonQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      seasonId: itemDetail?.seasonId,
    }),
  );

  return {
    itemDetail,
    seriesInfo,
    autoCommentsData,
    streamInfo,
    episodes,
  };
}
