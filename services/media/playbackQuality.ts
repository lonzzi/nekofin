export const playbackQualityOptions = [
  { id: 'auto', title: 'Auto', maxBitrate: undefined },
  { id: '100000000', title: '100 Mbps', maxBitrate: 100000000 },
  { id: '40000000', title: '40 Mbps', maxBitrate: 40000000 },
  { id: '20000000', title: '20 Mbps', maxBitrate: 20000000 },
  { id: '10000000', title: '10 Mbps', maxBitrate: 10000000 },
  { id: '8000000', title: '8 Mbps', maxBitrate: 8000000 },
  { id: '4000000', title: '4 Mbps', maxBitrate: 4000000 },
  { id: '2000000', title: '2 Mbps', maxBitrate: 2000000 },
  { id: '1000000', title: '1 Mbps', maxBitrate: 1000000 },
  { id: '500000', title: '500 Kbps', maxBitrate: 500000 },
] as const;

export type PlaybackQuality = (typeof playbackQualityOptions)[number]['id'];

export function parsePlaybackQuality(value: unknown): PlaybackQuality | undefined {
  return playbackQualityOptions.find((option) => option.id === value)?.id;
}

/** Auto follows existing playback settings; a manual cap applies to this session only. */
export function applyPlaybackQuality<T extends { enableTranscoding: boolean; maxBitrate: number }>(
  quality: PlaybackQuality | undefined,
  defaults: T,
): T {
  const maxBitrate = playbackQualityOptions.find((option) => option.id === quality)?.maxBitrate;
  return maxBitrate == null ? defaults : { ...defaults, enableTranscoding: true, maxBitrate };
}
