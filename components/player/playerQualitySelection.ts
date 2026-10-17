import type { RawMediaStream } from '@/services/media/mappers';

/** Invert native track IDs only within the original file's selected media source. */
export function serverIndexForNativeTrack({
  type,
  nativeId,
  nativeTracks,
  serverStreams,
  externalIds,
}: {
  type: 'Audio' | 'Subtitle';
  nativeId: number;
  nativeTracks: { id: number; type: string; isExternal?: boolean }[];
  serverStreams: RawMediaStream[];
  externalIds?: ReadonlyMap<number, number>;
}) {
  if (type === 'Subtitle' && nativeId <= 0) return -1;
  for (const [index, id] of externalIds ?? []) if (id === nativeId) return index;
  const tracks = nativeTracks.filter(
    (track) => track.type === (type === 'Audio' ? 'audio' : 'sub') && !track.isExternal,
  );
  const position = tracks.findIndex((track) => track.id === nativeId);
  if (position < 0) return undefined;
  return (
    serverStreams.filter(
      (track) => track.Type === type && !track.IsExternal && track.DeliveryMethod !== 'External',
    )[position]?.Index ?? undefined
  );
}
