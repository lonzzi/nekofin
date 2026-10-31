import { t as tr } from '@/lib/i18n';
import { MediaItem } from '@/services/media/types';

export const getInitialSeasonId = (seasons: MediaItem[], seasonId?: string): string =>
  seasonId || seasons[0]?.id || '';

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
  selectedEpisode: MediaItem,
): MediaItem => {
  if (episodes.length === 0) return selectedEpisode;

  return episodes.some((episode) => episode.id === selectedEpisode.id)
    ? selectedEpisode
    : episodes[0];
};

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
