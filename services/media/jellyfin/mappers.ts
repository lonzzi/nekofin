import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import { normalizeMediaItemType, normalizePersonType } from '../itemTypes';
import type { MediaItem, MediaPage } from '../types';

type JellyfinItemsPayload = {
  Items?: BaseItemDto[] | null;
  TotalRecordCount?: number | null;
};

type JellyfinResponse<T> = {
  data?: T | null;
};

export function convertBaseItemDtoToMediaItem(item: BaseItemDto): MediaItem {
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
    collectionType: item.CollectionType,
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

export function parseJellyfinItems(payload?: JellyfinItemsPayload | null): MediaItem[] {
  return payload?.Items?.map(convertBaseItemDtoToMediaItem) ?? [];
}

export function parseJellyfinItemsResponse(
  response: JellyfinResponse<JellyfinItemsPayload>,
): MediaItem[] {
  return parseJellyfinItems(response.data);
}

export function parseJellyfinItemsPage(
  response: JellyfinResponse<JellyfinItemsPayload>,
): MediaPage<MediaItem> {
  return {
    items: parseJellyfinItems(response.data),
    total: response.data?.TotalRecordCount ?? undefined,
  };
}

export function parseJellyfinItemArrayResponse(
  response: JellyfinResponse<BaseItemDto[]>,
): MediaPage<MediaItem> {
  return {
    items: response.data?.map(convertBaseItemDtoToMediaItem) ?? [],
  };
}
