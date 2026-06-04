import type { MediaPlaybackInfo, MediaSource } from '../types';
import type { EmbyApi, EmbyPlaybackInfoMediaSource, EmbyPlaybackInfoResponse } from './types';

export function mapEmbyMediaSource(source: EmbyPlaybackInfoMediaSource): MediaSource {
  return {
    id: source.Id || '',
    protocol: source.Protocol || '',
    container: source.Container || '',
    size: source.Size,
    bitrate: source.Bitrate,
    mediaStreams:
      source.MediaStreams?.map((stream) => ({
        codec: stream.Codec || '',
        type: stream.Type === 'Audio' || stream.Type === 'Subtitle' ? stream.Type : 'Video',
        index: stream.Index || 0,
        language: stream.Language,
        isDefault: stream.IsDefault,
        isForced: stream.IsForced,
        width: stream.Width,
        height: stream.Height,
        bitRate: stream.BitRate,
        averageFrameRate: stream.AverageFrameRate,
        realFrameRate: stream.RealFrameRate,
        profile: stream.Profile,
        level: stream.Level,
        pixelFormat: stream.PixelFormat,
        bitDepth: stream.BitDepth,
        isInterlaced: stream.IsInterlaced,
        aspectRatio: stream.AspectRatio,
        videoRange: stream.VideoRange,
        channels: stream.Channels,
        channelLayout: stream.ChannelLayout,
        sampleRate: stream.SampleRate,
        title: stream.Title,
      })) || [],
  };
}

export function mapEmbyPlaybackInfo(
  playback: EmbyPlaybackInfoResponse | null | undefined,
): MediaPlaybackInfo {
  return {
    mediaSources: playback?.MediaSources?.map(mapEmbyMediaSource) ?? [],
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
