import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getNextMediaPageParam, type InfiniteMediaPage } from './pagination';
import { mediaQueryKeys, type StreamInfoKeyOptions } from './queryKeys';
import type {
  MediaAdapter,
  MediaItem,
  MediaItemQueryFilters,
  MediaItemType,
  MediaPlaybackInfo,
  MediaServerInfo,
} from './types';

const FOLDER_PAGE_SIZE = 60;
const FAVORITES_PAGE_SIZE = 40;
const VIEW_ALL_PAGE_SIZE = 40;

export type MediaItemsPage = InfiniteMediaPage<MediaItem>;

export type DetailBundleMode = 'series' | 'season' | 'movie' | 'episode';

export type DetailBundle = {
  item: MediaItem;
  seasons?: MediaItem[];
  nextUpItems?: MediaItem[];
  episodes?: MediaItem[];
  similarShows?: MediaItem[];
  similarMovies?: MediaItem[];
} | null;

export function folderItemsQueryOptions({
  adapter,
  currentServer,
  folderId,
  filters,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  folderId: string | null | undefined;
  filters: MediaItemQueryFilters;
}) {
  return infiniteQueryOptions({
    enabled: !!currentServer && !!folderId,
    queryKey: mediaQueryKeys.folderItems(currentServer?.id, folderId, filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }): Promise<MediaItemsPage> => {
      if (!currentServer || !folderId) return { items: [], total: 0 };
      const response = await adapter.getAllItemsByFolder({
        userId: currentServer.userId,
        folderId,
        startIndex: pageParam,
        limit: FOLDER_PAGE_SIZE,
        itemTypes: filters.includeItemTypes ?? [],
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onlyUnplayed: filters.onlyUnplayed,
        year: filters.year,
        tags: filters.tags,
      });
      const items = response.items;
      const total = response.total ?? items.length;
      return { items, total };
    },
    getNextPageParam: getNextMediaPageParam,
  });
}

export function favoritesQueryOptions({
  adapter,
  currentServer,
  filters,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  filters: MediaItemQueryFilters;
}) {
  return infiniteQueryOptions({
    enabled: !!currentServer,
    queryKey: mediaQueryKeys.favorites(currentServer?.id, filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }): Promise<MediaItemsPage> => {
      if (!currentServer) return { items: [], total: 0 };
      const response = await adapter.getFavoriteItemsPaged({
        userId: currentServer.userId,
        startIndex: pageParam,
        limit: FAVORITES_PAGE_SIZE,
        includeItemTypes: filters.includeItemTypes ?? [],
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        onlyUnplayed: filters.onlyUnplayed,
        year: filters.year,
        tags: filters.tags,
      });
      const items = response.items;
      const total = response.total ?? items.length;
      return { items, total };
    },
    getNextPageParam: getNextMediaPageParam,
  });
}

export function viewAllQueryOptions({
  adapter,
  currentServer,
  type,
  folderId,
  filters,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  type: string;
  folderId?: string;
  filters: MediaItemQueryFilters;
}) {
  return infiniteQueryOptions({
    enabled: !!currentServer,
    queryKey: mediaQueryKeys.viewAll(currentServer?.id, type, folderId, filters),
    initialPageParam: 0,
    queryFn: async (): Promise<MediaItemsPage> => {
      if (!currentServer) return { items: [], total: 0 };

      switch (type) {
        case 'resume': {
          const response = await adapter.getResumeItems({
            userId: currentServer.userId,
            limit: VIEW_ALL_PAGE_SIZE,
          });
          return { items: response.items, total: response.items.length };
        }
        case 'nextup': {
          const response = await adapter.getNextUpItems({
            userId: currentServer.userId,
            limit: VIEW_ALL_PAGE_SIZE,
          });
          return { items: response.items, total: response.items.length };
        }
        case 'latest': {
          if (folderId) {
            const response = await adapter.getLatestItemsByFolder({
              userId: currentServer.userId,
              folderId,
              limit: VIEW_ALL_PAGE_SIZE,
            });
            return { items: response.items, total: response.items.length };
          }

          const response = await adapter.getLatestItems({
            userId: currentServer.userId,
            limit: VIEW_ALL_PAGE_SIZE,
            includeItemTypes: filters.includeItemTypes,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            year: filters.year,
            tags: filters.tags,
          });
          return { items: response.items, total: response.items.length };
        }
        default:
          return { items: [], total: 0 };
      }
    },
    getNextPageParam: getNextMediaPageParam,
  });
}

export function viewAllItemLayoutType(type: string): 'series' | 'episode' {
  return type === 'latest' ? 'series' : 'episode';
}

export function normalizeRouteItemType(itemTypes?: MediaItemType): MediaItemType[] | undefined {
  return itemTypes ? [itemTypes] : undefined;
}

export function homeResumeQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return queryOptions({
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeSection(currentServer?.id, 'resume'),
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await adapter.getResumeItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.items;
    },
  });
}

export function homeNextUpQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return queryOptions({
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeSection(currentServer?.id, 'nextup'),
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await adapter.getNextUpItems({
        userId: currentServer.userId,
        limit: 10,
      });
      return response.items;
    },
  });
}

export function homeUserViewsQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return queryOptions({
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeSection(currentServer?.id, 'allUserView'),
    queryFn: async () => {
      if (!currentServer) return [];
      const userView = await adapter.getUserView({ userId: currentServer.userId });
      return (userView || []).filter((item) => item.collectionType !== 'playlists');
    },
  });
}

export function homeLatestByFolderQueryOptions({
  adapter,
  currentServer,
  folderId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  folderId: string;
}) {
  return queryOptions({
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeLatest(currentServer?.id, folderId),
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await adapter.getLatestItemsByFolder({
        userId: currentServer.userId,
        folderId,
        limit: 16,
      });
      return response.items;
    },
  });
}

export function homeRandomQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return queryOptions({
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeSection(currentServer?.id, 'random'),
    queryFn: async () => {
      if (!currentServer) return [];
      return await adapter.getRandomItems({
        userId: currentServer.userId,
        limit: 6,
      });
    },
  });
}

export function detailBundleQueryOptions({
  adapter,
  currentServer,
  mode,
  itemId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  mode: DetailBundleMode;
  itemId: string;
}) {
  return queryOptions({
    enabled: !!itemId && !!currentServer?.userId,
    queryKey: mediaQueryKeys.detailBundle(currentServer?.id, mode, itemId),
    queryFn: async (): Promise<DetailBundle> => {
      if (!itemId || !currentServer?.userId) return null;
      const userId = currentServer.userId;
      const item = await adapter.getItemDetail({ itemId, userId });

      if (mode === 'series') {
        const [seasons, nextUpItems, similarShows] = await Promise.all([
          adapter.getSeasonsBySeries({ seriesId: itemId, userId }),
          adapter.getNextUpItemsByFolder({ userId, folderId: itemId, limit: 30 }),
          adapter.getSimilarShows({ itemId, userId, limit: 30 }),
        ]);
        return {
          item,
          seasons: seasons.items,
          nextUpItems: nextUpItems.items,
          similarShows: similarShows.items,
        };
      }

      if (mode === 'season') {
        const episodes = await adapter.getEpisodesBySeason({ seasonId: itemId, userId });
        return {
          item,
          episodes: episodes.items,
        };
      }

      if (mode === 'episode') {
        const [similarMovies, seasons, episodes] = await Promise.all([
          adapter.getSimilarMovies({ itemId, userId, limit: 30 }),
          item.seriesId
            ? adapter.getSeasonsBySeries({ seriesId: item.seriesId, userId })
            : Promise.resolve({ items: [] }),
          item.parentId
            ? adapter.getEpisodesBySeason({ seasonId: item.parentId, userId })
            : Promise.resolve({ items: [] }),
        ]);

        return {
          item,
          seasons: seasons.items,
          episodes: episodes.items,
          similarMovies: similarMovies.items,
        };
      }

      const similarMovies = await adapter.getSimilarMovies({ itemId, userId, limit: 30 });
      return {
        item,
        similarMovies: similarMovies.items,
      };
    },
  });
}

export function availableFiltersQueryOptions({
  adapter,
  currentServer,
  enabled,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  enabled: boolean;
}) {
  return queryOptions({
    enabled: enabled && !!currentServer?.userId,
    queryKey: mediaQueryKeys.availableFilters(currentServer?.id),
    queryFn: async () => {
      if (!currentServer?.userId) return { years: [], tags: [], genres: [] };
      return await adapter.getAvailableFilters({ userId: currentServer.userId });
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function firstEpisodeBySeasonQueryOptions({
  adapter,
  currentServer,
  seasonId,
  enabled,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  seasonId: string | null | undefined;
  enabled: boolean;
}) {
  return queryOptions({
    enabled: enabled && !!seasonId && !!currentServer?.userId,
    queryKey: mediaQueryKeys.firstEpisodeBySeason(
      currentServer?.id,
      seasonId,
      currentServer?.userId,
    ),
    queryFn: async () => {
      if (!seasonId || !currentServer?.userId) return null;
      const episodes = await adapter.getEpisodesBySeason({
        seasonId,
        userId: currentServer.userId,
      });
      return episodes.items[0] ?? null;
    },
  });
}

export function serverUserViewsQueryOptions({
  adapter,
  server,
}: {
  adapter: MediaAdapter | null;
  server: MediaServerInfo | undefined;
}) {
  return queryOptions({
    enabled: !!adapter && !!server?.userId,
    queryKey: mediaQueryKeys.serverUserViews(server?.id),
    queryFn: async () => {
      if (!adapter || !server?.userId) return [];
      const userView = await adapter.getUserView({ userId: server.userId });
      return (userView || []).filter((item) => item.collectionType !== 'playlists');
    },
  });
}

export function recommendedSearchItemsQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return queryOptions({
    enabled: !!currentServer?.userId,
    queryKey: mediaQueryKeys.recommendedSearchItems(currentServer?.id),
    queryFn: async () => {
      if (!currentServer?.userId) return [];
      return await adapter.getRandomItems({
        userId: currentServer.userId,
        limit: 20,
      });
    },
  });
}

export function searchItemsQueryOptions({
  adapter,
  currentServer,
  keyword,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  keyword: string;
}) {
  return queryOptions({
    enabled: !!currentServer?.userId && keyword.length > 0,
    queryKey: mediaQueryKeys.searchItems(currentServer?.id, keyword),
    queryFn: async () => {
      if (!currentServer?.userId) return [];
      return await adapter.searchItems({
        userId: currentServer.userId,
        searchTerm: keyword,
        limit: 120,
      });
    },
  });
}

export function itemDetailQueryOptions({
  adapter,
  currentServer,
  itemId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  itemId: string | null | undefined;
}) {
  return queryOptions({
    enabled: !!itemId && !!currentServer?.userId,
    queryKey: mediaQueryKeys.itemDetail(currentServer?.id, itemId, currentServer?.userId),
    queryFn: async (): Promise<MediaItem | null> => {
      if (!itemId || !currentServer?.userId) return null;
      return await adapter.getItemDetail({
        itemId,
        userId: currentServer.userId,
      });
    },
  });
}

export function episodesBySeasonQueryOptions({
  adapter,
  currentServer,
  seasonId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  seasonId: string | null | undefined;
}) {
  return queryOptions({
    enabled: !!seasonId && !!currentServer?.userId,
    queryKey: mediaQueryKeys.episodes(currentServer?.id, seasonId, currentServer?.userId),
    queryFn: async (): Promise<MediaItem[]> => {
      if (!seasonId || !currentServer?.userId) return [];
      const response = await adapter.getEpisodesBySeason({
        seasonId,
        userId: currentServer.userId,
      });
      return response.items;
    },
  });
}

export function mediaSourcesQueryOptions({
  adapter,
  currentServer,
  itemId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  itemId: string | null | undefined;
}) {
  return queryOptions({
    enabled: !!itemId,
    queryKey: mediaQueryKeys.mediaSources(currentServer?.id, itemId, currentServer?.userId),
    queryFn: async (): Promise<MediaPlaybackInfo | null> => {
      if (!itemId) return null;
      return await adapter.getItemMediaSources({
        itemId,
      });
    },
  });
}

export function streamInfoQueryOptions({
  adapter,
  currentServer,
  item,
  keyOptions,
  deviceProfile,
  deviceId,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  item: MediaItem | null | undefined;
  keyOptions: StreamInfoKeyOptions;
  deviceProfile: unknown;
  deviceId: string;
}) {
  return queryOptions({
    enabled: !!currentServer?.userId && !!item,
    queryKey: mediaQueryKeys.streamInfo(
      currentServer?.id,
      item?.id,
      currentServer?.userId,
      keyOptions,
    ),
    queryFn: async () => {
      if (!currentServer?.userId || !item) return null;
      return await adapter.getStreamInfo({
        item,
        userId: currentServer.userId,
        deviceProfile,
        startTimeTicks: item.userData?.playbackPositionTicks || 0,
        deviceId,
        maxStreamingBitrate: keyOptions.enableTranscoding ? keyOptions.maxBitrate : undefined,
        alwaysBurnInSubtitleWhenTranscoding: keyOptions.enableSubtitleBurnIn,
      });
    },
    staleTime: 0,
    gcTime: 0,
  });
}
