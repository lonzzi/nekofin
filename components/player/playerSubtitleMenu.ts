import type { RawMediaStream } from '@/services/media/mappers';
import { playbackTrackLabel } from '@/services/media/playbackSelection';
import type { MediaSource } from '@/services/media/types';

import type { TrackInfo } from './PlayerContext';
import { serverIndexForNativeTrack } from './playerQualitySelection';

export type SubtitleChoice = { itemId: string; sourceId: string; index: number };

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
) {
  const ids = new Map<number, number>();
  for (const track of nativeTracks.filter((entry) => entry.type === 'sub')) {
    const index = serverIndexForNativeTrack({
      type: 'Subtitle',
      nativeId: track.id,
      nativeTracks,
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
      nativeTracks,
      serverStreams,
      externalIds,
    }),
  };
}
