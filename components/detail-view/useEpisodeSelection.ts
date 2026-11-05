import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { QUERY_CACHE_MAX_AGE_MS } from '@/lib/queryCachePolicy';
import type { PlaybackEpisode } from '@/services/media/playbackEpisode';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { episodesBySeasonQueryOptions } from '@/services/media/queryOptions';
import type { MediaItem } from '@/services/media/types';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getDisplayEpisodes,
  getEpisodeSeasonId,
  getInitialEpisodeChoice,
  getSelectedEpisodeOrFallback,
} from './episodeSelection';

const EMPTY_EPISODES: MediaItem[] = [];

export function useEpisodeSelection({
  item,
  seasons,
  episodes = EMPTY_EPISODES,
  nextUpItems = EMPTY_EPISODES,
  seasonId,
}: {
  item: MediaItem;
  seasons: MediaItem[];
  episodes?: MediaItem[];
  nextUpItems?: MediaItem[];
  seasonId?: string;
}) {
  const adapter = useMediaAdapter();
  const { currentServer } = useMediaServers();
  const focused = useIsFocused();
  const seriesId = item.type === 'Series' ? item.id : item.seriesId;
  const playback = useQuery<PlaybackEpisode>({
    queryKey: mediaQueryKeys.playbackEpisode(currentServer?.id, currentServer?.userId, seriesId),
    queryFn: skipToken,
    enabled: false,
    staleTime: Infinity,
    gcTime: QUERY_CACHE_MAX_AGE_MS,
  });
  // Explicit episode links open that episode; series pages prefer the last played or next-up item.
  const preferredEpisode = item.type === 'Episode' ? item : (playback.data?.item ?? nextUpItems[0]);
  const [choice, setChoice] = useState(() =>
    getInitialEpisodeChoice(seasons, preferredEpisode, seasonId),
  );
  const selection = useRef({ playback: playback.data, manual: false });

  useEffect(() => {
    if (!focused) return;
    if (playback.data && selection.current.playback !== playback.data) {
      selection.current.playback = playback.data;
      setChoice(getInitialEpisodeChoice(seasons, playback.data.item));
      return;
    }
    // Refresh the automatic next-up choice without replacing a manual or local playback choice.
    if (selection.current.manual || item.type !== 'Series' || playback.data) return;
    const refreshed = getInitialEpisodeChoice(seasons, preferredEpisode, seasonId);
    setChoice((previous) =>
      previous.seasonId === refreshed.seasonId && previous.episodeId === refreshed.episodeId
        ? previous
        : refreshed,
    );
  }, [focused, item.type, playback.data, preferredEpisode, seasonId, seasons]);

  const episodeQuery = useQueryWithFocus({
    ...episodesBySeasonQueryOptions({ adapter, currentServer, seasonId: choice.seasonId }),
    initialData:
      episodes.length && getEpisodeSeasonId(episodes[0], seasons) === choice.seasonId
        ? episodes
        : undefined,
  });
  const displayEpisodes = getDisplayEpisodes({
    selectedSeasonId: choice.seasonId,
    currentSeasonEpisodes: episodeQuery.data ?? EMPTY_EPISODES,
    fallbackEpisodes: episodes,
  });
  const knownEpisode =
    displayEpisodes.find((episode) => episode.id === choice.episodeId) ??
    [playback.data?.item, preferredEpisode, ...episodes].find(
      (episode) => episode?.id === choice.episodeId,
    );
  let selectedEpisode = getSelectedEpisodeOrFallback(
    displayEpisodes,
    displayEpisodes.length || episodeQuery.isPending ? knownEpisode : undefined,
  );
  if (
    playback.data &&
    selectedEpisode?.id === playback.data.item.id &&
    playback.dataUpdatedAt > episodeQuery.dataUpdatedAt
  ) {
    selectedEpisode = playback.data.item;
  }

  const selectSeason = useCallback((nextSeasonId: string) => {
    selection.current.manual = true;
    setChoice((previous) =>
      previous.seasonId === nextSeasonId
        ? previous
        : { seasonId: nextSeasonId, episodeId: undefined },
    );
  }, []);
  const selectEpisode = useCallback(
    (episode: MediaItem) => {
      selection.current.manual = true;
      setChoice((previous) => ({
        seasonId: getEpisodeSeasonId(episode, seasons) || previous.seasonId,
        episodeId: episode.id,
      }));
    },
    [seasons],
  );

  return {
    selectedEpisode,
    selectedSeasonId: choice.seasonId,
    displayEpisodes,
    selectEpisode,
    selectSeason,
    isPending: !!choice.seasonId && episodeQuery.isPending,
    isError: episodeQuery.isError,
    refetch: episodeQuery.refetch,
  };
}
