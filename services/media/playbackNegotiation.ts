/** Stream indices are scoped to the requested version, never a fallback version. */
export function selectPlaybackMediaSource<T extends { Id?: string | null }>(
  playback: { MediaSources?: T[] | null; ErrorCode?: string | null },
  requestedSourceId?: string | null,
): T {
  if (playback.ErrorCode) throw new Error('Playback negotiation failed');
  const source = requestedSourceId
    ? playback.MediaSources?.find((entry) => entry.Id === requestedSourceId)
    : playback.MediaSources?.[0];
  if (!source) throw new Error('Requested playback source is unavailable');
  return source;
}
