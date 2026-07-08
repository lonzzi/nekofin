import { mapMediaSource } from '../mappers';
import type { MediaPlaybackInfo } from '../types';
import type { EmbyApi, EmbyPlaybackInfoResponse } from './types';

export function mapEmbyPlaybackInfo(
  playback: EmbyPlaybackInfoResponse | null | undefined,
): MediaPlaybackInfo {
  return {
    mediaSources: playback?.MediaSources?.map(mapMediaSource) ?? [],
  };
}

export function buildEmbyStreamUrl({
  api,
  itemId,
  mediaSource,
  userId,
  startTimeTicks,
  maxStreamingBitrate,
  playSessionId,
  audioStreamIndex,
  subtitleStreamIndex,
  deviceId,
}: {
  api: EmbyApi;
  itemId: string;
  mediaSource?: { Id?: string; TranscodingUrl?: string };
  userId: string;
  startTimeTicks?: number;
  maxStreamingBitrate?: number;
  playSessionId?: string | null;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  deviceId?: string | null;
}): string {
  if (mediaSource?.TranscodingUrl) {
    return `${api.basePath}${mediaSource.TranscodingUrl}`;
  }

  const qs = new URLSearchParams();
  qs.set('static', 'true');
  qs.set('container', 'mp4');
  qs.set('mediaSourceId', mediaSource?.Id || '');
  if (typeof subtitleStreamIndex === 'number') {
    qs.set('subtitleStreamIndex', String(subtitleStreamIndex));
  }
  if (typeof audioStreamIndex === 'number') {
    qs.set('audioStreamIndex', String(audioStreamIndex));
  }
  if (deviceId) qs.set('deviceId', deviceId);
  if (api.accessToken) qs.set('api_key', api.accessToken);
  qs.set('startTimeTicks', String(startTimeTicks || 0));
  if (maxStreamingBitrate) qs.set('maxStreamingBitrate', String(maxStreamingBitrate));
  qs.set('userId', userId);
  if (playSessionId) qs.set('playSessionId', playSessionId);

  return `${api.basePath}/Videos/${itemId}/stream?${qs.toString()}`;
}
