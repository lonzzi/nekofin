import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { dandanplayCommentsQueryOptions } from '@/services/dandanplayQueryOptions';
import { getDanmakuByItem } from '@/services/danmaku';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import {
  needsPlaybackPreferenceTracks,
  resolvePreferredPlaybackTracks,
  type PlaybackPreferences,
} from '@/services/media/playbackSelection';
import type { StreamInfoKeyOptions } from '@/services/media/queryKeys';
import {
  episodesBySeasonQueryOptions,
  itemDetailQueryOptions,
  mediaSourcesQueryOptions,
  streamInfoQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaAdapter, MediaServerInfo } from '@/services/media/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export function usePlayerQueries({
  itemId,
  mediaAdapter,
  currentServer,
  useManualComments,
  streamInfoKeyOptions,
  streamDeviceProfile,
  streamDeviceId,
  playbackAttempt,
  preferences,
}: {
  itemId: string;
  mediaAdapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  useManualComments: boolean;
  streamInfoKeyOptions: StreamInfoKeyOptions;
  streamDeviceProfile: unknown;
  streamDeviceId: string;
  playbackAttempt: number;
  preferences: PlaybackPreferences;
}) {
  const { sources } = useDanmakuSources();
  const { settings } = useDanmakuSettings();
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
      sourcesKey: danmakuSourcesKey(sources),
      enabled: settings.enabled && sources.some((source) => source.enabled),
      fetchComments: (item, originalTitle, signal) =>
        getDanmakuByItem(item, originalTitle, sources, signal),
    }),
  );

  const { data: playbackInfo, isPending: tracksPending } = useQuery(
    mediaSourcesQueryOptions({ adapter: mediaAdapter, currentServer, itemId }),
  );
  const playbackSelection = useMemo(
    () =>
      resolvePreferredPlaybackTracks(
        playbackInfo?.mediaSources ?? [],
        streamInfoKeyOptions,
        preferences,
      ),
    [playbackInfo, streamInfoKeyOptions, preferences],
  );
  const streamOptions = streamInfoQueryOptions({
    adapter: mediaAdapter,
    currentServer,
    item: itemDetail,
    keyOptions: { ...streamInfoKeyOptions, ...playbackSelection },
    deviceProfile: streamDeviceProfile,
    deviceId: streamDeviceId,
    playbackAttempt,
  });
  const { data: streamInfo, error: streamInfoError } = useQuery({
    ...streamOptions,
    // Avoid starting HLS with the server's default audio before preferences resolve.
    enabled:
      streamOptions.enabled &&
      (!needsPlaybackPreferenceTracks(streamInfoKeyOptions, preferences) || !tracksPending),
  });

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
    streamInfoError,
    playbackSelection,
    mediaSources: playbackInfo?.mediaSources ?? [],
    episodes,
  };
}
