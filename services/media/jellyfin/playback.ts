import type { MediaPlaybackInfo, MediaSource } from '../types';

type JellyfinMediaStream = {
  Codec?: string | null;
  Type?: string | null;
  Index?: number | null;
  Language?: string | null;
  IsDefault?: boolean | null;
  IsForced?: boolean | null;
  Width?: number | null;
  Height?: number | null;
  BitRate?: number | null;
  AverageFrameRate?: number | null;
  RealFrameRate?: number | null;
  Profile?: string | null;
  Level?: number | null;
  PixelFormat?: string | null;
  BitDepth?: number | null;
  IsInterlaced?: boolean | null;
  AspectRatio?: string | null;
  VideoRange?: string | null;
  Channels?: number | null;
  ChannelLayout?: string | null;
  SampleRate?: number | null;
  Title?: string | null;
};

type JellyfinMediaSource = {
  Id?: string | null;
  Protocol?: string | null;
  Container?: string | null;
  Size?: number | null;
  Bitrate?: number | null;
  MediaStreams?: JellyfinMediaStream[] | null;
};

export function mapJellyfinMediaSource(source: JellyfinMediaSource): MediaSource {
  return {
    id: source.Id || '',
    protocol: source.Protocol || '',
    container: source.Container || '',
    size: source.Size ?? undefined,
    bitrate: source.Bitrate ?? undefined,
    mediaStreams:
      source.MediaStreams?.map((stream) => ({
        codec: stream.Codec || '',
        type: (stream.Type as 'Video' | 'Audio' | 'Subtitle') || 'Video',
        index: stream.Index || 0,
        language: stream.Language ?? undefined,
        isDefault: stream.IsDefault ?? undefined,
        isForced: stream.IsForced ?? undefined,
        width: stream.Width ?? undefined,
        height: stream.Height ?? undefined,
        bitRate: stream.BitRate ?? undefined,
        averageFrameRate: stream.AverageFrameRate ?? undefined,
        realFrameRate: stream.RealFrameRate ?? undefined,
        profile: stream.Profile ?? undefined,
        level: stream.Level ?? undefined,
        pixelFormat: stream.PixelFormat ?? undefined,
        bitDepth: stream.BitDepth ?? undefined,
        isInterlaced: stream.IsInterlaced ?? undefined,
        aspectRatio: stream.AspectRatio ?? undefined,
        videoRange: stream.VideoRange ?? undefined,
        channels: stream.Channels ?? undefined,
        channelLayout: stream.ChannelLayout ?? undefined,
        sampleRate: stream.SampleRate ?? undefined,
        title: stream.Title ?? undefined,
      })) || [],
  };
}

export function mapJellyfinPlaybackInfo(playback?: {
  MediaSources?: JellyfinMediaSource[] | null;
}): MediaPlaybackInfo {
  return {
    mediaSources: playback?.MediaSources?.map(mapJellyfinMediaSource) ?? [],
  };
}
