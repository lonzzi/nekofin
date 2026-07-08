export type EmbyApi = {
  basePath: string;
  accessToken: string | null;
};

export type EmbyPublicSystemInfo = {
  ServerName?: string;
  Version?: string;
  OperatingSystem?: string;
};

export type EmbyPublicUser = {
  Id?: string;
  Name?: string;
  ServerName?: string;
  PrimaryImageTag?: string;
};

export type EmbyAuthenticateResponse = {
  User?: { Id?: string; Name?: string };
  AccessToken?: string;
};

export type EmbyPlaybackInfoMediaStream = {
  Codec?: string;
  Type?: 'Video' | 'Audio' | 'Subtitle';
  Index?: number;
  Language?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  Width?: number;
  Height?: number;
  BitRate?: number;
  AverageFrameRate?: number;
  RealFrameRate?: number;
  Profile?: string;
  Level?: number;
  PixelFormat?: string;
  BitDepth?: number;
  IsInterlaced?: boolean;
  AspectRatio?: string;
  VideoRange?: string;
  Channels?: number;
  ChannelLayout?: string;
  SampleRate?: number;
  Title?: string;
};

export type EmbyPlaybackInfoMediaSource = {
  Id?: string;
  Protocol?: string;
  Container?: string;
  Size?: number;
  Bitrate?: number;
  MediaStreams?: EmbyPlaybackInfoMediaStream[];
  TranscodingUrl?: string;
};

export type EmbyPlaybackInfoResponse = {
  PlaySessionId?: string;
  MediaSources?: EmbyPlaybackInfoMediaSource[];
};

export type EmbyFiltersResponse = { Years?: number[]; Tags?: string[]; Genres?: string[] };
