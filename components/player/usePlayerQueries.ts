import { useSubtitlePrefetch } from '@/hooks/useSubtitlePrefetch';
import { useDanmakuSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { useDanmakuSources } from '@/lib/contexts/DanmakuSourcesContext';
import { dandanplayCommentsQueryOptions } from '@/services/dandanplayQueryOptions';
import { getDanmakuByItem } from '@/services/danmaku';
import { danmakuSourcesKey } from '@/services/danmakuSources';
import {
  needsPlaybackPreferenceTracks,
  resolvePlaybackSelection,
  resolvePreferredPlaybackTracks,
  type PlaybackPreferences,
} from '@/services/media/playbackSelection';
import type { StreamInfoKeyOptions } from '@/services/media/queryKeys';
import {
  episodesBySeasonQueryOptions,
  itemDetailQueryOptions,
  mediaSegmentsQueryOptions,
  mediaSourcesQueryOptions,
  playbackItemDetailQueryOptions,
  streamInfoQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaAdapter, MediaSegment, MediaServerInfo } from '@/services/media/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const EMPTY_SEGMENTS: MediaSegment[] = [];

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
  subtitlePrefetchChoice,
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
  subtitlePrefetchChoice?: { sourceId: string; index: number };
}) {
  const { sources } = useDanmakuSources();
  const { settings } = useDanmakuSettings();
  const { data: itemDetail, isFetchedAfterMount: hasFreshPlaybackItem } = useQuery(
    playbackItemDetailQueryOptions({
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
  // Segment metadata is optional and must never delay stream negotiation.
  const { data: mediaSegments = EMPTY_SEGMENTS, isPending: segmentsPending } = useQuery(
    mediaSegmentsQueryOptions({ adapter: mediaAdapter, currentServer, itemId }),
  );
  const playbackSelection = useMemo(() => {
    const preferred = resolvePreferredPlaybackTracks(
      playbackInfo?.mediaSources ?? [],
      streamInfoKeyOptions,
      preferences,
    );
    const source = playbackInfo?.mediaSources[0];
    // Some servers ignore stream indices until they are scoped to a media source.
    // Direct player entry must use the same version as the detail playback menu.
    return !preferred.mediaSourceId && source
      ? { ...preferred, mediaSourceId: source.id }
      : preferred;
  }, [playbackInfo, streamInfoKeyOptions, preferences]);
  const subtitlePrefetchSelection = resolvePlaybackSelection(
    playbackInfo?.mediaSources ?? [],
    playbackSelection,
    preferences,
  );
  // Prefetch the selected subtitle alongside stream negotiation.
  useSubtitlePrefetch(
    itemId,
    playbackInfo?.mediaSources.find(
      (source) => source.id === subtitlePrefetchSelection.mediaSourceId,
    ),
    subtitlePrefetchChoice &&
      subtitlePrefetchChoice.sourceId === subtitlePrefetchSelection.mediaSourceId
      ? subtitlePrefetchChoice.index
      : subtitlePrefetchSelection.subtitleStreamIndex,
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
      hasFreshPlaybackItem &&
      (!!streamInfoKeyOptions.mediaSourceId || !tracksPending) &&
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
    mediaSegments,
    segmentsPending,
    episodes,
  };
}
