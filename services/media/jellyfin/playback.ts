import { mapMediaSource, type RawMediaSource } from '../mappers';
import type { MediaPlaybackInfo } from '../types';

export function mapJellyfinPlaybackInfo(playback?: {
  MediaSources?: RawMediaSource[] | null;
}): MediaPlaybackInfo {
  return {
    mediaSources: playback?.MediaSources?.map(mapMediaSource) ?? [],
  };
}
