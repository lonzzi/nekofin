import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import { normalizeMediaItemType, normalizePersonType } from './itemTypes';
import type { MediaItem, MediaSource } from './types';

/**
 * Jellyfin and Emby both speak the same PascalCase wire format (`BaseItemDto`),
 * so a single normalizer serves both adapters. Emby responses are typed as
 * `BaseItemDto` at their call sites too, so no per-server input type is needed.
 */
export function mapRawItemToMediaItem(item: BaseItemDto): MediaItem {
  const serverType = item.Type ?? null;

  return {
    id: item.Id || '',
    name: item.Name || '',
    type: normalizeMediaItemType(serverType),
    serverType,
    raw: item,
    seriesName: item.SeriesName,
    seriesId: item.SeriesId,
    parentId: item.ParentId,
    path: item.Path,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    primaryImageAspectRatio: item.PrimaryImageAspectRatio,
    productionYear: item.ProductionYear,
    premiereDate: item.PremiereDate,
    dateCreated: item.DateCreated,
    endDate: item.EndDate,
    status: item.Status as 'Continuing' | 'Ended' | undefined,
    overview: item.Overview,
    taglines: item.Taglines,
    tags: item.Tags,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    officialRating: item.OfficialRating,
    genres: item.Genres,
    genreItems: item.GenreItems?.map((g) => ({ name: g.Name || '' })),
    productionLocations: item.ProductionLocations,
    people: item.People?.map((p) => ({
      name: p.Name || '',
      id: p.Id || '',
      type: normalizePersonType(p.Type),
      serverType: p.Type ?? null,
      role: p.Role,
      primaryImageTag: p.PrimaryImageTag,
      imageBlurHashes: p.ImageBlurHashes,
      raw: p,
    })),
    studios: item.Studios?.map((s) => ({ name: s.Name || '' })),
    providerIds: item.ProviderIds,
    userData: item.UserData
      ? {
          played: item.UserData.Played,
          playedPercentage: item.UserData.PlayedPercentage,
          isFavorite: item.UserData.IsFavorite,
          playbackPositionTicks: item.UserData.PlaybackPositionTicks,
        }
      : undefined,
    runTimeTicks: item.RunTimeTicks,
    cumulativeRunTimeTicks: item.CumulativeRunTimeTicks,
    originalTitle: item.OriginalTitle,
    seasonId: item.SeasonId,
    recursiveItemCount: item.RecursiveItemCount,
    childCount: item.ChildCount,
    mediaSourceCount: item.MediaSourceCount,
    mediaType: item.MediaType,
    isFolder: item.IsFolder,
    container: item.Container,
    collectionType: item.CollectionType ?? undefined,
    imageTags: item.ImageTags,
    backdropImageTags: item.BackdropImageTags,
    screenshotImageTags: item.ScreenshotImageTags,
    parentLogoItemId: item.ParentLogoItemId,
    parentLogoImageTag: item.ParentLogoImageTag,
    parentBackdropItemId: item.ParentBackdropItemId,
    parentBackdropImageTags: item.ParentBackdropImageTags,
    parentThumbItemId: item.ParentThumbItemId,
    parentThumbImageTag: item.ParentThumbImageTag,
    parentPrimaryImageItemId: item.ParentPrimaryImageItemId,
    parentPrimaryImageTag: item.ParentPrimaryImageTag,
    seriesPrimaryImageTag: item.SeriesPrimaryImageTag,
    seriesThumbImageTag: item.SeriesThumbImageTag,
    imageBlurHashes: item.ImageBlurHashes,
  };
}

/**
 * Shared raw MediaStream/MediaSource shape (PascalCase). Fields are nullable to
 * accept both the Jellyfin SDK types and the Emby response types.
 */
export type RawMediaStream = {
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

export type RawMediaSource = {
  Id?: string | null;
  Protocol?: string | null;
  Container?: string | null;
  Size?: number | null;
  Bitrate?: number | null;
  MediaStreams?: RawMediaStream[] | null;
};

export function mapMediaStream(stream: RawMediaStream): MediaSource['mediaStreams'][number] {
  return {
    codec: stream.Codec || '',
    // Preserve the raw stream type; only fall back to 'Video' when it is absent.
    // (Coercing every non-Audio/Subtitle type to 'Video' would misclassify
    // embedded-image/data streams and surface a spurious video info card.)
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
  };
}

export function mapMediaSource(source: RawMediaSource): MediaSource {
  return {
    id: source.Id || '',
    protocol: source.Protocol || '',
    container: source.Container || '',
    size: source.Size ?? undefined,
    bitrate: source.Bitrate ?? undefined,
    mediaStreams: source.MediaStreams?.map(mapMediaStream) ?? [],
  };
}
