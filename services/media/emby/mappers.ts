import type { BaseItemDtoImageBlurHashes } from '@jellyfin/sdk/lib/generated-client/models';
import type { BaseItemPersonImageBlurHashes } from '@jellyfin/sdk/lib/generated-client/models/base-item-person-image-blur-hashes';

import { normalizeMediaItemType, normalizePersonType } from '../itemTypes';
import type { MediaItem } from '../types';

export type EmbyBaseItemDto = {
  Id?: string | null;
  Name?: string | null;
  Type?: string | null;
  SeriesName?: string | null;
  SeriesId?: string | null;
  ParentId?: string | null;
  Path?: string | null;
  IndexNumber?: number | null;
  ParentIndexNumber?: number | null;
  PrimaryImageAspectRatio?: number | null;
  ProductionYear?: number | null;
  PremiereDate?: string | null;
  DateCreated?: string | null;
  EndDate?: string | null;
  Status?: string | null;
  Overview?: string | null;
  Taglines?: string[] | null;
  Tags?: string[] | null;
  CommunityRating?: number | null;
  CriticRating?: number | null;
  OfficialRating?: string | null;
  Genres?: string[] | null;
  GenreItems?: { Name?: string | null }[] | null;
  ProviderIds?: Record<string, string | null> | null;
  ProductionLocations?: string[] | null;
  People?:
    | {
        Id?: string | null;
        Name?: string | null;
        Type?: string | null;
        Role?: string | null;
        PrimaryImageTag?: string | null;
        ImageBlurHashes?: BaseItemPersonImageBlurHashes | null;
      }[]
    | null;
  Studios?: { Name?: string | null }[] | null;
  UserData?: {
    Played?: boolean | null;
    PlayedPercentage?: number | null;
    IsFavorite?: boolean | null;
    PlaybackPositionTicks?: number | null;
  } | null;
  RunTimeTicks?: number | null;
  CumulativeRunTimeTicks?: number | null;
  OriginalTitle?: string | null;
  SeasonId?: string | null;
  RecursiveItemCount?: number | null;
  ChildCount?: number | null;
  MediaSourceCount?: number | null;
  MediaType?: string | null;
  IsFolder?: boolean | null;
  Container?: string | null;
  CollectionType?: string | null;
  ImageTags?: Record<string, string> | null;
  BackdropImageTags?: string[] | null;
  ScreenshotImageTags?: string[] | null;
  ParentLogoItemId?: string | null;
  ParentLogoImageTag?: string | null;
  ParentBackdropItemId?: string | null;
  ParentBackdropImageTags?: string[] | null;
  ParentThumbItemId?: string | null;
  ParentThumbImageTag?: string | null;
  ParentPrimaryImageItemId?: string | null;
  ParentPrimaryImageTag?: string | null;
  SeriesPrimaryImageTag?: string | null;
  SeriesThumbImageTag?: string | null;
  ImageBlurHashes?: BaseItemDtoImageBlurHashes | null;
};

export function convertEmbyItemToMediaItem(item: EmbyBaseItemDto): MediaItem {
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
    providerIds: item.ProviderIds,
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
