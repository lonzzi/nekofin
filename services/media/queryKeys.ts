import type { MediaItemQueryFilters } from './types';

export type StreamInfoKeyOptions = {
  enableTranscoding: boolean;
  maxBitrate: number;
  enableSubtitleBurnIn: boolean;
  selectedCodec: string;
};

function sortedValues<T extends string | number>(values: T[] | undefined) {
  return values?.length ? [...values].sort() : undefined;
}

function normalizeFilters(filters: MediaItemQueryFilters) {
  return {
    ...(filters.includeItemTypes?.length
      ? { includeItemTypes: sortedValues(filters.includeItemTypes) }
      : {}),
    ...(filters.sortBy?.length ? { sortBy: [...filters.sortBy] } : {}),
    ...(filters.sortOrder ? { sortOrder: filters.sortOrder } : {}),
    ...(filters.onlyUnplayed ? { onlyUnplayed: true } : {}),
    ...(filters.year !== undefined ? { year: filters.year } : {}),
    ...(filters.tags?.length ? { tags: sortedValues(filters.tags) } : {}),
  };
}

function normalizeStreamInfoOptions(options: StreamInfoKeyOptions) {
  return {
    enableTranscoding: options.enableTranscoding,
    maxBitrate: options.maxBitrate,
    enableSubtitleBurnIn: options.enableSubtitleBurnIn,
    selectedCodec: options.selectedCodec,
  };
}

export const mediaQueryKeys = {
  all: ['media'] as const,
  server: (serverId: string | null | undefined) =>
    [...mediaQueryKeys.all, 'server', serverId ?? null] as const,
  home: (serverId: string | null | undefined) =>
    [...mediaQueryKeys.server(serverId), 'home'] as const,
  homeSection: (serverId: string | null | undefined, section: string) =>
    [...mediaQueryKeys.home(serverId), section] as const,
  homeLatest: (serverId: string | null | undefined, folderId: string | null | undefined) =>
    [...mediaQueryKeys.home(serverId), 'latest', folderId ?? null] as const,
  availableFilters: (serverId: string | null | undefined) =>
    [...mediaQueryKeys.server(serverId), 'available-filters'] as const,
  folderItems: (
    serverId: string | null | undefined,
    folderId: string | null | undefined,
    filters: MediaItemQueryFilters,
  ) =>
    [
      ...mediaQueryKeys.server(serverId),
      'folder-items',
      folderId ?? null,
      normalizeFilters(filters),
    ] as const,
  viewAll: (
    serverId: string | null | undefined,
    type: string,
    folderId: string | null | undefined,
    filters: MediaItemQueryFilters,
  ) =>
    [
      ...mediaQueryKeys.server(serverId),
      'view-all',
      type,
      folderId ?? null,
      normalizeFilters(filters),
    ] as const,
  favorites: (serverId: string | null | undefined, filters: MediaItemQueryFilters) =>
    [...mediaQueryKeys.server(serverId), 'favorites', normalizeFilters(filters)] as const,
  detailBundle: (
    serverId: string | null | undefined,
    mode: string,
    itemId: string | null | undefined,
  ) => [...mediaQueryKeys.server(serverId), 'detail-bundle', mode, itemId ?? null] as const,
  itemDetail: (
    serverId: string | null | undefined,
    itemId: string | null | undefined,
    userId: string | null | undefined,
  ) => [...mediaQueryKeys.server(serverId), 'item-detail', itemId ?? null, userId ?? null] as const,
  episodes: (
    serverId: string | null | undefined,
    seasonId: string | null | undefined,
    userId: string | null | undefined,
  ) => [...mediaQueryKeys.server(serverId), 'episodes', seasonId ?? null, userId ?? null] as const,
  firstEpisodeBySeason: (
    serverId: string | null | undefined,
    seasonId: string | null | undefined,
    userId: string | null | undefined,
  ) =>
    [
      ...mediaQueryKeys.server(serverId),
      'first-episode-by-season',
      seasonId ?? null,
      userId ?? null,
    ] as const,
  serverUserViews: (serverId: string | null | undefined) =>
    [...mediaQueryKeys.server(serverId), 'server-config', 'user-views'] as const,
  recommendedSearchItems: (serverId: string | null | undefined) =>
    [...mediaQueryKeys.server(serverId), 'search', 'recommended-items'] as const,
  searchItems: (serverId: string | null | undefined, keyword: string) =>
    [...mediaQueryKeys.server(serverId), 'search', 'items', keyword] as const,
  mediaSources: (
    serverId: string | null | undefined,
    itemId: string | null | undefined,
    userId: string | null | undefined,
  ) =>
    [...mediaQueryKeys.server(serverId), 'media-sources', itemId ?? null, userId ?? null] as const,
  comments: (
    serverId: string | null | undefined,
    itemId: string | null | undefined,
    originalTitle: string | null | undefined,
  ) =>
    [
      ...mediaQueryKeys.server(serverId),
      'comments',
      itemId ?? null,
      originalTitle ?? null,
    ] as const,
  streamInfo: (
    serverId: string | null | undefined,
    itemId: string | null | undefined,
    userId: string | null | undefined,
    options: StreamInfoKeyOptions,
  ) =>
    [
      ...mediaQueryKeys.server(serverId),
      'stream-info',
      itemId ?? null,
      userId ?? null,
      normalizeStreamInfoOptions(options),
    ] as const,
};
