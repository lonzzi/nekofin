export const PLAYBACK_DECODING_MODES = ['auto', 'hardware', 'software'] as const;
export type PlaybackDecodingMode = (typeof PLAYBACK_DECODING_MODES)[number];

export function parsePlaybackDecodingMode(value: string | undefined): PlaybackDecodingMode | null {
  return PLAYBACK_DECODING_MODES.find((mode) => mode === value) ?? null;
}

export function playbackHwdec(mode: PlaybackDecodingMode, platform: string) {
  if (mode === 'software') return 'no';
  if (platform === 'android') return mode === 'auto' ? 'auto' : 'mediacodec';
  return 'videotoolbox';
}
