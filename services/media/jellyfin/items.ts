import type { Api } from '@jellyfin/sdk';
import { BaseItemDto, BaseItemKind, ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models';
import {
  getFilterApi,
  getItemsApi,
  getLibraryApi,
  getSearchApi,
  getTvShowsApi,
  getUserLibraryApi,
  getUserViewsApi,
} from '@jellyfin/sdk/lib/utils/api';

export async function getLatestItems(
  api: Api,
  userId: string,
  limit: number = 100,
  opts?: {
    includeItemTypes?: BaseItemKind[];
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    year?: number;
    tags?: string[];
  },
) {
  return await getItemsApi(api).getItems({
    userId,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    includeItemTypes: opts?.includeItemTypes ?? ['Movie', 'Series', 'Episode'],
    recursive: true,
    filters: ['IsNotFolder'],
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function getLatestItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  limit: number = 100,
) {
  return await getUserLibraryApi(api).getLatestMedia({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    parentId: folderId,
  });
}

export async function getNextUpItems(api: Api, userId: string, limit: number = 100) {
  return await getTvShowsApi(api).getNextUp({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio', 'DateCreated', 'MediaSourceCount'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Banner', 'Thumb'],
  });
}

export async function getNextUpItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  limit: number = 100,
) {
  return await getTvShowsApi(api).getNextUp({
    userId,
    limit,
    parentId: folderId,
  });
}

export async function getResumeItems(api: Api, userId: string, limit: number = 100) {
  return await getItemsApi(api).getResumeItems({
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    mediaTypes: ['Video'],
    enableTotalRecordCount: false,
  });
}

export async function getFavoriteItems(api: Api, userId: string, limit: number = 200) {
  return await getItemsApi(api).getItems({
    userId,
    limit,
    sortBy: ['DateCreated'],
    sortOrder: ['Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    filters: ['IsFavorite'],
    recursive: true,
    includeItemTypes: ['Movie', 'Series', 'Episode'],
  });
}

export async function getFavoriteItemsPaged(
  api: Api,
  userId: string,
  startIndex: number = 0,
  limit: number = 40,
  opts?: {
    includeItemTypes?: BaseItemKind[];
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    onlyUnplayed?: boolean;
    year?: number;
    tags?: string[];
  },
) {
  const filters: ('IsFavorite' | 'IsPlayed' | 'IsUnplayed')[] = ['IsFavorite'];
  if (opts?.onlyUnplayed) filters.push('IsUnplayed');

  return await getItemsApi(api).getItems({
    userId,
    startIndex,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    filters,
    recursive: true,
    includeItemTypes: opts?.includeItemTypes ?? ['Movie', 'Series', 'Episode'],
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function getUserView(api: Api, userId: string) {
  return await getUserViewsApi(api).getUserViews({
    userId,
  });
}

export async function getAllItemsByFolder(
  api: Api,
  userId: string,
  folderId: string,
  startIndex: number = 0,
  limit: number = 200,
  itemTypes: BaseItemKind[] = ['Movie', 'Series', 'Episode'],
  opts?: {
    sortBy?: ItemSortBy[];
    sortOrder?: 'Ascending' | 'Descending';
    onlyUnplayed?: boolean;
    year?: number;
    tags?: string[];
  },
) {
  const filters: ('IsPlayed' | 'IsUnplayed')[] = [];
  if (opts?.onlyUnplayed) filters.push('IsUnplayed');

  return await getItemsApi(api).getItems({
    userId,
    parentId: folderId,
    recursive: true,
    limit,
    sortBy: opts?.sortBy ?? ['DateCreated'],
    sortOrder: [opts?.sortOrder ?? 'Descending'],
    fields: ['PrimaryImageAspectRatio', 'Path'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    includeItemTypes: itemTypes,
    startIndex,
    filters,
    years: opts?.year ? [opts.year] : undefined,
    tags: opts?.tags,
  });
}

export async function getSeasonsBySeries(api: Api, seriesId: string, userId: string) {
  return await getItemsApi(api).getItems({
    userId,
    parentId: seriesId,
    includeItemTypes: ['Season'],
    recursive: false,
    sortBy: ['IndexNumber'],
    sortOrder: ['Ascending'],
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
  });
}

export async function getEpisodesBySeason(api: Api, seasonId: string, userId: string) {
  return await getTvShowsApi(api).getEpisodes({
    userId,
    seasonId,
    fields: ['ItemCounts', 'PrimaryImageAspectRatio', 'CanDelete', 'MediaSourceCount', 'Overview'],
    seriesId: seasonId,
  });
}

export async function getSimilarShows(
  api: Api,
  itemId: string,
  userId: string,
  limit: number = 30,
) {
  return await getLibraryApi(api).getSimilarShows({
    itemId,
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
  });
}

export async function getSimilarMovies(
  api: Api,
  itemId: string,
  userId: string,
  limit: number = 30,
) {
  return await getLibraryApi(api).getSimilarMovies({
    itemId,
    userId,
    limit,
    fields: ['PrimaryImageAspectRatio'],
  });
}

export async function getSearchHints(
  api: Api,
  searchTerm: string,
  userId?: string,
  limit: number = 10,
) {
  return await getSearchApi(api).getSearchHints({
    searchTerm,
    userId,
    limit,
    includeMedia: true,
    includePeople: false,
    includeGenres: false,
    includeStudios: false,
    includeArtists: false,
  });
}

export async function searchItems(
  api: Api,
  userId: string,
  searchTerm: string,
  limit: number = 100,
  includeItemTypes: BaseItemKind[] = ['Movie', 'Series', 'Episode'],
): Promise<BaseItemDto[]> {
  const res = await getItemsApi(api).getItems({
    userId,
    searchTerm,
    limit,
    recursive: true,
    sortBy: ['SortName'],
    sortOrder: ['Ascending'],
    includeItemTypes,
    fields: ['PrimaryImageAspectRatio'],
    imageTypeLimit: 1,
    enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
  });
  return res.data?.Items ?? [];
}

export async function getRecommendedSearchKeywords(api: Api, userId: string, limit: number = 20) {
  const res = await getItemsApi(api).getItems({
    userId,
    limit,
    recursive: true,
    includeItemTypes: ['Movie', 'Series', 'MusicArtist'],
    sortBy: ['IsFavoriteOrLiked', 'Random'],
    imageTypeLimit: 0,
    enableTotalRecordCount: false,
    enableImages: false,
  });
  const items = res.data?.Items ?? [];
  const titles = items.map((i) => i.Name).filter((v): v is string => Boolean(v));
  return Array.from(new Set(titles)).slice(0, limit);
}

export async function getRandomItems(
  api: Api,
  userId: string,
  limit: number = 20,
): Promise<BaseItemDto[]> {
  const res = await getItemsApi(api).getItems({
    userId,
    limit,
    recursive: true,
    includeItemTypes: ['Movie', 'Series'],
    sortBy: ['Random'],
    fields: ['ParentId'],
    imageTypeLimit: 0,
    enableTotalRecordCount: false,
    enableImages: false,
  });
  return res.data?.Items ?? [];
}

export type AvailableFilters = {
  years: number[];
  tags: string[];
  genres: string[];
};

export async function getAvailableFilters(
  api: Api,
  userId: string,
  parentId?: string,
): Promise<AvailableFilters> {
  const res = await getFilterApi(api).getQueryFiltersLegacy({ userId, parentId });
  const d = res.data as { Years?: number[]; Tags?: string[]; Genres?: string[] };

  return {
    years: Array.isArray(d?.Years)
      ? d!.Years!.filter((x): x is number => typeof x === 'number')
      : [],
    tags: Array.isArray(d?.Tags) ? d!.Tags!.filter((x): x is string => typeof x === 'string') : [],
    genres: Array.isArray(d?.Genres)
      ? d!.Genres!.filter((x): x is string => typeof x === 'string')
      : [],
  };
}
