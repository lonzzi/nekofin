import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import type { MediaItem, MediaItemType, MediaPage } from '../types';

type JellyfinItemsPayload = {
  Items?: BaseItemDto[] | null;
  TotalRecordCount?: number | null;
};

type JellyfinResponse<T> = {
  data?: T | null;
};

export function convertBaseItemDtoToMediaItem(item: BaseItemDto): MediaItem {
  return {
    id: item.Id || '',
    name: item.Name || '',
    type: (item.Type as MediaItemType) || 'Other',
    raw: item,
    seriesName: item.SeriesName,
    seriesId: item.SeriesId,
    parentId: item.ParentId,
    indexNumber: item.IndexNumber,
    parentIndexNumber: item.ParentIndexNumber,
    productionYear: item.ProductionYear,
    endDate: item.EndDate,
    status: item.Status as 'Continuing' | 'Ended' | undefined,
    overview: item.Overview,
    communityRating: item.CommunityRating,
    criticRating: item.CriticRating,
    officialRating: item.OfficialRating,
    genres: item.Genres,
    genreItems: item.GenreItems?.map((g) => ({ name: g.Name || '' })),
    people: item.People?.map((p) => ({
      name: p.Name || '',
      id: p.Id || '',
      type: (p.Type as 'Actor' | 'Director' | 'Writer' | 'Producer') || 'Actor',
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
    originalTitle: item.OriginalTitle,
    seasonId: item.SeasonId,
    collectionType: item.CollectionType,
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
