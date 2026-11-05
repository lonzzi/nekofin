import { t as tr } from '@/lib/i18n';
import { MediaItem } from '@/services/media/types';

export const getInitialSeasonId = (seasons: MediaItem[], seasonId?: string): string =>
  seasonId || seasons.find((season) => season.indexNumber !== 0)?.id || seasons[0]?.id || '';

export function getEpisodeSeasonId(episode: MediaItem | undefined, seasons: MediaItem[]) {
  return (
    episode?.seasonId ||
    episode?.parentId ||
    seasons.find(
      (season) =>
        episode?.parentIndexNumber != null && season.indexNumber === episode.parentIndexNumber,
    )?.id
  );
}

export function getInitialEpisodeChoice(
  seasons: MediaItem[],
  episode?: MediaItem,
  seasonId?: string,
) {
  const episodeSeasonId = getEpisodeSeasonId(episode, seasons);
  const selectedSeasonId = getInitialSeasonId(seasons, seasonId || episodeSeasonId);
  return {
    seasonId: selectedSeasonId,
    episodeId: !episodeSeasonId || episodeSeasonId === selectedSeasonId ? episode?.id : undefined,
  };
}

export const getDisplayEpisodes = ({
  selectedSeasonId,
  currentSeasonEpisodes,
  fallbackEpisodes,
}: {
  selectedSeasonId: string;
  currentSeasonEpisodes: MediaItem[];
  fallbackEpisodes: MediaItem[];
}): MediaItem[] => (selectedSeasonId ? currentSeasonEpisodes : fallbackEpisodes);

export const getSelectedEpisodeOrFallback = (
  episodes: MediaItem[],
  selectedEpisode?: MediaItem,
): MediaItem | undefined =>
  episodes.find((episode) => episode.id === selectedEpisode?.id) ??
  episodes.find(
    (episode) => !episode.userData?.played && (episode.userData?.playbackPositionTicks ?? 0) > 0,
  ) ??
  episodes.find((episode) => !episode.userData?.played) ??
  episodes[0] ??
  selectedEpisode;

export const findEpisodeIndex = (episodes: MediaItem[], selectedEpisodeId?: string): number => {
  if (!selectedEpisodeId) return -1;

  return episodes.findIndex((episode) => episode.id === selectedEpisodeId);
};

/** Keep the first rendered card inside the list's actual scrollable range. */
export function getInitialEpisodeScrollIndex({
  selectedIndex,
  episodeCount,
  cardWidth,
  gap,
  horizontalPadding,
  viewportWidth,
}: {
  selectedIndex: number;
  episodeCount: number;
  cardWidth: number;
  gap: number;
  horizontalPadding: number;
  viewportWidth: number;
}) {
  const stride = cardWidth + gap;
  const contentWidth = episodeCount * stride - gap + horizontalPadding * 2;
  const lastScrollableIndex = Math.floor(Math.max(0, contentWidth - viewportWidth) / stride);
  // VirtualizedList skips cells before initialScrollIndex. If the native scroll
  // offset is clamped at the end, skipping those cells would leave an empty gap.
  return Math.max(0, Math.min(selectedIndex, lastScrollableIndex));
}

export const getSeasonTitle = (season?: MediaItem): string => {
  if (!season) return '';

  if (season.name) return season.name;

  return typeof season.indexNumber === 'number'
    ? tr('media.seasonByIndex', { indexNumber: season.indexNumber })
    : tr('media.unknownSeason');
};

export const getEpisodeHeaderText = (episode: MediaItem): string => {
  const seriesName = episode.seriesName?.trim();
  const episodeNumber =
    typeof episode.indexNumber === 'number'
      ? tr('media.episodeByIndex', { indexNumber: episode.indexNumber })
      : '';

  if (seriesName && episodeNumber) return `${seriesName} ${episodeNumber}`;
  if (seriesName) return seriesName;
  if (episodeNumber) return episodeNumber;

  return episode.name ?? '';
};

export const getSeasonActions = (seasons: MediaItem[], selectedSeasonId: string) =>
  seasons.map((season) => ({
    id: season.id,
    title: getSeasonTitle(season),
    state: season.id === selectedSeasonId ? ('on' as const) : ('off' as const),
  }));
