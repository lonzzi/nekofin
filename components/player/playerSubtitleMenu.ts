import type { RawMediaStream } from '@/services/media/mappers';
import { playbackTrackLabel } from '@/services/media/playbackSelection';
import type { MediaSource } from '@/services/media/types';

import type { TrackInfo } from './PlayerContext';
import { serverIndexForNativeTrack } from './playerQualitySelection';

export type SubtitleChoice = { itemId: string; sourceId: string; index: number };

/** Video transcoding does not require server-side switching of external subtitles. */
export function requiresServerSubtitleSwitch(
  source: { TranscodingUrl?: string | null; MediaStreams?: RawMediaStream[] | null } | undefined,
  index: number | undefined,
  playbackUrl?: string | null,
) {
  if (!source) return false;
  if (source.TranscodingUrl) {
    try {
      const url = new URL(playbackUrl ?? source.TranscodingUrl, 'https://media.invalid');
      if (
        [...url.searchParams].some(
          ([key, value]) =>
            key.toLowerCase() === 'subtitlemethod' && value.toLowerCase() === 'encode',
        )
      )
        return true;
    } catch {
      // Fall back to the negotiated stream metadata.
    }
  }
  if (index == null || index < 0) return false;
  const track = source.MediaStreams?.find(
    (stream) => stream.Type === 'Subtitle' && stream.Index === index,
  );
  return (
    !!track &&
    (track.DeliveryMethod === 'Encode' ||
      (!!source.TranscodingUrl && !track.IsExternal && track.DeliveryMethod !== 'External'))
  );
}

export function subtitleChoiceForSource(
  choice: SubtitleChoice | null,
  itemId: string,
  sourceId: string | undefined,
) {
  return choice?.itemId === itemId && choice.sourceId === sourceId ? choice.index : undefined;
}

export function isSubtitlePending(
  index: number | undefined,
  nativeIds: ReadonlyMap<number, number> | undefined,
  failedIndices: ReadonlySet<number>,
) {
  return index != null && index >= 0 && !nativeIds?.has(index) && !failedIndices.has(index);
}

/** Menu rows describe server streams, including sidecars not downloaded yet. */
export function deriveSubtitleMenuTracks(
  source: MediaSource,
  nativeIds: ReadonlyMap<number, number>,
  selectedIndex: number | undefined,
  failedIndices: ReadonlySet<number>,
): TrackInfo[] {
  return source.mediaStreams
    .filter((stream) => stream.type === 'Subtitle')
    .map((stream) => ({
      index: stream.index,
      name: playbackTrackLabel(stream),
      language: stream.language ?? undefined,
      loading:
        stream.index === selectedIndex &&
        isSubtitlePending(selectedIndex, nativeIds, failedIndices),
      failed: failedIndices.has(stream.index),
    }));
}

/** Keep server indices separate from mpv's IDs, even with interleaved sidecars. */
export function deriveNativeSubtitleState(
  nativeTracks: { id: number; type: string; isExternal?: boolean }[],
  serverStreams: RawMediaStream[],
  selectedNativeId: number,
  externalIds?: ReadonlyMap<number, number>,
  isTranscoding = false,
) {
  // Embedded HLS subtitles have a different order from the original file.
  const tracks = isTranscoding ? nativeTracks.filter((track) => track.isExternal) : nativeTracks;
  const ids = new Map<number, number>();
  for (const track of tracks.filter((entry) => entry.type === 'sub')) {
    const index = serverIndexForNativeTrack({
      type: 'Subtitle',
      nativeId: track.id,
      nativeTracks: tracks,
      serverStreams,
      externalIds,
    });
    if (index != null && index >= 0) ids.set(index, track.id);
  }
  return {
    ids,
    selectedIndex: serverIndexForNativeTrack({
      type: 'Subtitle',
      nativeId: selectedNativeId,
      nativeTracks: tracks,
      serverStreams,
      externalIds,
    }),
  };
}
