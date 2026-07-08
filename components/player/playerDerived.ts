import { ticksToMilliseconds } from '@/lib/utils/duration';
import type { MediaItem } from '@/services/media/types';

type RawMediaStream = {
  Type?: string | null;
  Index?: number | null;
  DisplayTitle?: string | null;
  Language?: string | null;
  DeliveryMethod?: string | null;
  DeliveryUrl?: string | null;
};

export function deriveTracks(mediaStreams: RawMediaStream[] = []) {
  const audio = mediaStreams
    .filter((s) => s.Type === 'Audio')
    .map((s) => ({
      index: s.Index ?? 0,
      name: s.DisplayTitle ?? s.Language ?? `Audio ${s.Index ?? 0}`,
      language: s.Language ?? undefined,
    }));

  const subtitle = mediaStreams
    .filter((s) => s.Type === 'Subtitle')
    .map((s) => ({
      index: s.Index ?? 0,
      name: s.DisplayTitle ?? s.Language ?? `Subtitle ${s.Index ?? 0}`,
      language: s.Language ?? undefined,
    }));

  return { audio, subtitle };
}

export function deriveExternalSubtitles(mediaStreams: RawMediaStream[] = [], basePath?: string) {
  return mediaStreams
    .filter((sub) => sub.Type === 'Subtitle' && sub.DeliveryMethod === 'External')
    .map((sub) => ({
      index: sub.Index ?? 0,
      name: sub.DisplayTitle ?? sub.Language ?? '',
      url: `${basePath ?? ''}${sub.DeliveryUrl ?? ''}`,
    }));
}

export function deriveExternalAudio(mediaStreams: RawMediaStream[] = [], basePath?: string) {
  return mediaStreams
    .filter((audio) => audio.Type === 'Audio' && audio.DeliveryMethod === 'External')
    .filter((audio) => !!audio.DeliveryUrl)
    .map((audio) => ({
      index: audio.Index ?? 0,
      name: audio.DisplayTitle ?? audio.Language ?? '',
      url: `${basePath ?? ''}${audio.DeliveryUrl ?? ''}`,
    }));
}

export function formatPlayerTitle(item: MediaItem | null | undefined): string {
  if (!item) return '';

  const seriesName = item.seriesName ?? '';
  const seasonNumber = item.parentIndexNumber;
  const episodeNumber = item.indexNumber;
  const episodeName = item.name ?? '';

  if (seriesName && seasonNumber != null && episodeNumber != null) {
    return `${seriesName} S${seasonNumber}E${episodeNumber} - ${episodeName}`;
  }

  if (seriesName) {
    return episodeName ? `${seriesName} - ${episodeName}` : seriesName;
  }

  return episodeName;
}

export function deriveEpisodeNavigation(itemId: string, episodes: MediaItem[]) {
  const currentIndex = itemId ? episodes.findIndex((episode) => episode.id === itemId) : -1;
  const previousEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

  return {
    currentIndex,
    previousEpisode,
    nextEpisode,
    hasPreviousEpisode: !!previousEpisode,
    hasNextEpisode: !!nextEpisode,
  };
}

export function deriveDurationMs(
  item: MediaItem | null | undefined,
  fallbackDurationMs?: number | null,
): number {
  return item?.runTimeTicks ? ticksToMilliseconds(item.runTimeTicks) : (fallbackDurationMs ?? 0);
}
