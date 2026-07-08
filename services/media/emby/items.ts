import type { ApiClient } from '@/lib/request';
import { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';

import { normalizeMediaItemTypeList } from '../itemTypes';
import type {
  GetAllItemsByFolderParams,
  GetEpisodesBySeasonParams,
  GetFavoriteItemsPagedParams,
  GetFavoriteItemsParams,
  GetLatestItemsByFolderParams,
  GetLatestItemsParams,
  GetNextUpItemsByFolderParams,
  GetNextUpItemsParams,
  GetRecommendedSearchKeywordsParams,
  GetResumeItemsParams,
  GetSeasonsBySeriesParams,
  GetSimilarMoviesParams,
  GetSimilarShowsParams,
  GetUserViewParams,
  SearchItemsParams,
} from '../types';
import { applyDefaultImageAndFields, convertSortByToEmby } from './helpers';

export interface EmbyItemsResponse {
  Items?: BaseItemDto[];
  TotalRecordCount?: number;
}

const defaultItemParams = (fields?: string) => {
  const params = new URLSearchParams();
  applyDefaultImageAndFields(params, fields);
  return Object.fromEntries(params.entries());
};

const joinMediaItemTypes = (itemTypes: GetLatestItemsParams['includeItemTypes']) =>
  normalizeMediaItemTypeList(itemTypes)?.join(',');

export const getLatestItems = async (
  client: ApiClient,
  { userId, limit, includeItemTypes, sortBy, sortOrder, year, tags }: GetLatestItemsParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    Filters: 'IsNotFolder',
    Limit: limit,
    IncludeItemTypes: joinMediaItemTypes(includeItemTypes),
    SortBy: convertSortByToEmby(sortBy || []).join(','),
    SortOrder: sortOrder,
    Years: year,
    Tags: tags?.join(','),
    ...defaultItemParams(),
  });

export const getLatestItemsByFolder = async (
  client: ApiClient,
  { userId, folderId, limit }: GetLatestItemsByFolderParams,
) =>
  await client.get<BaseItemDto[]>(`/Users/${userId}/Items/Latest`, {
    Limit: limit,
    ParentId: folderId,
    ...defaultItemParams(),
  });

export const getNextUpItems = async (client: ApiClient, { userId, limit }: GetNextUpItemsParams) =>
  await client.get<EmbyItemsResponse>(`/Shows/NextUp`, {
    Limit: limit,
    UserId: userId,
    Fields: 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
  });

export const getNextUpItemsByFolder = async (
  client: ApiClient,
  { userId, folderId, limit }: GetNextUpItemsByFolderParams,
) =>
  await client.get<EmbyItemsResponse>(`/Shows/NextUp`, {
    Limit: limit,
    UserId: userId,
    ParentId: folderId,
  });

export const getResumeItems = async (client: ApiClient, { userId, limit }: GetResumeItemsParams) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items/Resume`, {
    Recursive: true,
    Fields: 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    MediaTypes: 'Video',
    Limit: limit,
  });

export const getFavoriteItems = async (
  client: ApiClient,
  { userId, limit }: GetFavoriteItemsParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    Filters: 'IsFavorite',
    Limit: limit,
    IncludeItemTypes: 'Movie,Series,Episode',
    SortBy: 'DateCreated',
    SortOrder: 'Descending',
    ...defaultItemParams(),
  });

export const getFavoriteItemsPaged = async (
  client: ApiClient,
  {
    userId,
    startIndex,
    limit,
    includeItemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetFavoriteItemsPagedParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    StartIndex: startIndex,
    Limit: limit,
    Recursive: true,
    Filters: onlyUnplayed ? 'IsFavorite,IsUnplayed' : 'IsFavorite',
    IncludeItemTypes: joinMediaItemTypes(includeItemTypes),
    SortBy: convertSortByToEmby(sortBy || []).join(','),
    SortOrder: sortOrder,
    Years: year,
    Tags: tags?.join(','),
    ...defaultItemParams(),
  });

export const getUserView = async (client: ApiClient, { userId }: GetUserViewParams) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Views`);

export const getAllItemsByFolder = async (
  client: ApiClient,
  {
    userId,
    folderId,
    startIndex,
    limit,
    itemTypes,
    sortBy,
    sortOrder,
    onlyUnplayed,
    year,
    tags,
  }: GetAllItemsByFolderParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    ParentId: folderId,
    Recursive: true,
    StartIndex: startIndex,
    Limit: limit,
    IncludeItemTypes: joinMediaItemTypes(itemTypes),
    SortBy: convertSortByToEmby(sortBy || []).join(','),
    SortOrder: sortOrder,
    Filters: onlyUnplayed ? 'IsUnplayed' : undefined,
    Years: year,
    Tags: tags?.join(','),
    ...defaultItemParams(),
  });

export const getSeasonsBySeries = async (
  client: ApiClient,
  { seriesId, userId }: GetSeasonsBySeriesParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    ParentId: seriesId,
    IncludeItemTypes: 'Season',
    Recursive: false,
    SortBy: 'IndexNumber',
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageAspectRatio',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

export const getEpisodesBySeason = async (
  client: ApiClient,
  { seasonId, userId }: GetEpisodesBySeasonParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    ParentId: seasonId,
    IncludeItemTypes: 'Episode',
    Fields: 'ItemCounts,PrimaryImageAspectRatio,CanDelete,MediaSourceCount,Overview',
  });

export const getSimilarShows = async (
  client: ApiClient,
  { itemId, userId, limit }: GetSimilarShowsParams,
) =>
  await client.get<EmbyItemsResponse>(`/Items/${itemId}/Similar`, {
    Limit: limit,
    UserId: userId,
    IncludeItemTypes: 'Series',
    Fields: 'PrimaryImageAspectRatio',
  });

export const getSimilarMovies = async (
  client: ApiClient,
  { itemId, userId, limit }: GetSimilarMoviesParams,
) =>
  await client.get<EmbyItemsResponse>(`/Items/${itemId}/Similar`, {
    Limit: limit,
    UserId: userId,
    IncludeItemTypes: 'Movie',
    Fields: 'PrimaryImageAspectRatio',
  });

export const searchItems = async (
  client: ApiClient,
  { userId, searchTerm, limit, includeItemTypes }: SearchItemsParams,
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    SearchTerm: searchTerm,
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'PrimaryImageAspectRatio',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    Limit: limit,
    IncludeItemTypes: joinMediaItemTypes(includeItemTypes),
  });

export const getRecommendedSearchKeywords = async (
  client: ApiClient,
  { userId, limit }: GetRecommendedSearchKeywordsParams,
) =>
  await client.get<{ Items?: { Name?: string }[] }>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    IncludeItemTypes: 'Movie,Series,MusicArtist',
    SortBy: 'IsFavoriteOrLiked,Random',
    ImageTypeLimit: 0,
    EnableTotalRecordCount: false,
    EnableImages: false,
    Limit: limit,
  });

export const getRandomItems = async (
  client: ApiClient,
  { userId, limit }: { userId: string; limit?: number },
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    IncludeItemTypes: 'Movie,Series',
    SortBy: 'Random',
    Limit: limit,
    ...defaultItemParams(
      'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path,ParentId',
    ),
  });

// ── Folders (browse library subfolders) ───────────────────────────

export const getFoldersByParent = async (
  client: ApiClient,
  { userId, parentId }: { userId: string; parentId: string },
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    ParentId: parentId,
    Recursive: false,
    IncludeItemTypes: 'Folder,CollectionFolder',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'BasicSyncInfo,PrimaryImageAspectRatio,ProductionYear,Path',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
  });

// ── Box Sets (collections) ────────────────────────────────────────

export const getBoxSets = async (
  client: ApiClient,
  { userId, limit }: { userId: string; limit?: number },
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    IncludeItemTypes: 'BoxSet',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'BasicSyncInfo,PrimaryImageAspectRatio,ProductionYear,Overview',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    Limit: limit,
  });

// ── Playlists ─────────────────────────────────────────────────────

export const getPlaylists = async (
  client: ApiClient,
  { userId, limit }: { userId: string; limit?: number },
) =>
  await client.get<EmbyItemsResponse>(`/Users/${userId}/Items`, {
    UserId: userId,
    Recursive: true,
    IncludeItemTypes: 'Playlist',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    Fields: 'BasicSyncInfo,PrimaryImageAspectRatio,ProductionYear,Overview',
    ImageTypeLimit: 1,
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    Limit: limit,
  });

// ── Genres ────────────────────────────────────────────────────────

export const getGenres = async (
  client: ApiClient,
  { userId, parentId }: { userId: string; parentId?: string },
) => {
  const params: Record<string, unknown> = {
    UserId: userId,
    Recursive: true,
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    EnableImages: false,
    EnableTotalRecordCount: false,
  };
  if (parentId) params.ParentId = parentId;
  return await client.get<EmbyItemsResponse>(`/Genres`, params);
};

// ── Tags ──────────────────────────────────────────────────────────

export const getTags = async (
  client: ApiClient,
  { userId, parentId }: { userId: string; parentId?: string },
) => {
  const params: Record<string, unknown> = {
    UserId: userId,
    Recursive: true,
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    EnableImages: false,
    EnableTotalRecordCount: false,
  };
  if (parentId) params.ParentId = parentId;
  return await client.get<EmbyItemsResponse>(`/Tags`, params);
};
