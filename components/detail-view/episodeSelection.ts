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

export const getSeasonTitle = (season?: MediaItem): string => {
  if (!season) return '';

  if (season.name) return season.name;

  return typeof season.indexNumber === 'number' ? `第${season.indexNumber}季` : '未知季度';
};

export const getEpisodeHeaderText = (episode: MediaItem): string => {
  const seriesName = episode.seriesName?.trim();
  const episodeNumber = typeof episode.indexNumber === 'number' ? `第${episode.indexNumber}集` : '';

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
