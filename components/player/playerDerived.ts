import { t as tr } from '@/lib/i18n';
import { ticksToMilliseconds } from '@/lib/utils/duration';
import type { MediaItem } from '@/services/media/types';

type RawMediaStream = {
  Type?: string | null;
  Index?: number | null;
  DisplayTitle?: string | null;
  Title?: string | null;
  Language?: string | null;
  DeliveryMethod?: string | null;
  DeliveryUrl?: string | null;
  IsExternal?: boolean | null;
  Codec?: string | null;
};

type NativeMediaTrack = {
  id: number;
  type: string;
  title?: string;
  lang?: string;
  isExternal?: boolean;
};

/** Keep mpv aid/sid values while displaying the server's names when available. */
export function deriveMpvTracks(
  tracks: NativeMediaTrack[],
  mediaStreams: RawMediaStream[] = [],
  options: {
    isTranscoding?: boolean;
    audioIds?: ReadonlyMap<number, number>;
    subtitleIds?: ReadonlyMap<number, number>;
  } = {},
) {
  const derive = (type: 'Audio' | 'Subtitle') => {
    const nativeType = type === 'Audio' ? 'audio' : 'sub';
    const streams = mediaStreams.filter((stream) => stream.Type === type);
    const embedded = streams.filter(
      (stream) => !stream.IsExternal && stream.DeliveryMethod !== 'External',
    );
    const externalIds = type === 'Audio' ? options.audioIds : options.subtitleIds;
    let embeddedIndex = 0;
    return tracks
      .filter((track) => track.type === nativeType)
      .map((track) => {
        const stream = track.isExternal
          ? streams.find(
              (entry) => entry.Index != null && externalIds?.get(entry.Index) === track.id,
            )
          : options.isTranscoding
            ? undefined
            : embedded[embeddedIndex++];
        const fallback = [
          track.title?.trim(),
          track.lang ? `[${track.lang}]` : '',
          track.isExternal ? '(ext)' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return {
          index: track.id,
          name:
            stream?.DisplayTitle?.trim() ||
            fallback ||
            `${type === 'Audio' ? tr('player.audioTrack') : tr('player.subtitles')} ${track.id}`,
          language: stream?.Language?.trim() || track.lang || undefined,
        };
      });
  };
  return { audio: derive('Audio'), subtitle: derive('Subtitle') };
}

export function deriveTracks(mediaStreams: RawMediaStream[] = []) {
  const audio = mediaStreams
    .filter((s) => s.Type === 'Audio')
    .map((s) => ({
      index: s.Index ?? 0,
      name:
        s.DisplayTitle?.trim() ||
        s.Title?.trim() ||
        s.Language?.trim() ||
        tr('player.audioTrackByValue', { value: s.Index ?? 0 }),
      language: s.Language ?? undefined,
    }));

  const subtitle = mediaStreams
    .filter((s) => s.Type === 'Subtitle')
    .map((s) => ({
      index: s.Index ?? 0,
      name:
        s.DisplayTitle?.trim() ||
        s.Title?.trim() ||
        s.Language?.trim() ||
        tr('player.subtitleByValue', { value: s.Index ?? 0 }),
      language: s.Language ?? undefined,
    }));

  return { audio, subtitle };
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
  fallbackDurationSeconds?: number | null,
): number {
  return item?.runTimeTicks
    ? ticksToMilliseconds(item.runTimeTicks)
    : Math.max(0, (fallbackDurationSeconds ?? 0) * 1000);
}

/** Native loadfile expects seconds; preserve fractional resume positions. */
export function deriveStartPositionSeconds(positionMs: number, durationMs: number): number {
  const position = Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0;
  const bounded =
    Number.isFinite(durationMs) && durationMs > 0 ? Math.min(position, durationMs) : position;
  return bounded / 1000;
}

export function deriveBufferedProgress({
  positionSeconds,
  durationSeconds,
  bufferedDurationSeconds,
  bufferedPositionSeconds,
}: {
  positionSeconds: number;
  durationSeconds: number;
  bufferedDurationSeconds: number;
  bufferedPositionSeconds?: number;
}): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;

  const position = Number.isFinite(positionSeconds) ? Math.max(0, positionSeconds) : 0;
  const bufferedDuration = Number.isFinite(bufferedDurationSeconds)
    ? Math.max(0, bufferedDurationSeconds)
    : 0;
  const reportedBufferedPosition =
    bufferedPositionSeconds != null &&
    Number.isFinite(bufferedPositionSeconds) &&
    bufferedPositionSeconds > 0
      ? bufferedPositionSeconds
      : position + bufferedDuration;
  const absoluteBufferedPosition = Math.max(position, reportedBufferedPosition);

  return Math.min(1, absoluteBufferedPosition / durationSeconds);
}

export { deriveExternalAudio, deriveExternalSubtitles } from '@/services/media/externalTracks';
