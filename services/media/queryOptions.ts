import { QUERY_CACHE_MAX_AGE_MS } from '@/lib/queryCachePolicy';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { fetchVisibleHomePage, nextVisibleHomePage, type HomeLibraryScope } from './homeVisibility';
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
const HOME_SECTION_STALE_TIME_MS = 60 * 1000;

export type MediaItemsPage = InfiniteMediaPage<MediaItem> & { nextStartIndex?: number };

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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
  libraryIds,
  queryClient,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  type: string;
  folderId?: string;
  filters: MediaItemQueryFilters;
} & HomeLibraryScope) {
  const folderVisible = !!folderId && libraryIds.includes(folderId);
  return infiniteQueryOptions({
    gcTime: QUERY_CACHE_MAX_AGE_MS,
    enabled:
      !!currentServer?.userId && libraryIds.length > 0 && (type !== 'latest' || folderVisible),
    queryKey: [
      ...mediaQueryKeys.viewAll(currentServer?.id, type, folderId, filters),
      { libraryIds: [...libraryIds].sort() },
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0, signal }): Promise<MediaItemsPage> => {
      if (!currentServer || !libraryIds.length) return { items: [], total: 0 };

      switch (type) {
        case 'resume': {
          return fetchVisibleHomePage({
            adapter,
            server: currentServer,
            scope: { libraryIds, queryClient },
            limit: VIEW_ALL_PAGE_SIZE,
            startIndex: pageParam,
            signal,
            fetchPage: (startIndex, limit) =>
              adapter.getResumeItems({ userId: currentServer.userId, startIndex, limit }),
          });
        }
        case 'nextup': {
          return fetchVisibleHomePage({
            adapter,
            server: currentServer,
            scope: { libraryIds, queryClient },
            limit: VIEW_ALL_PAGE_SIZE,
            startIndex: pageParam,
            signal,
            fetchPage: (startIndex, limit) =>
              adapter.getNextUpItems({ userId: currentServer.userId, startIndex, limit }),
          });
        }
        case 'latest': {
          if (folderId && folderVisible) {
            const response = await adapter.getLatestItemsByFolder({
              userId: currentServer.userId,
              folderId,
              limit: VIEW_ALL_PAGE_SIZE,
            });
            return { items: response.items, total: response.items.length };
          }

          return { items: [], total: 0 };
        }
        default:
          return { items: [], total: 0 };
      }
    },
    getNextPageParam: (lastPage, pages) =>
      type === 'resume' || type === 'nextup'
        ? nextVisibleHomePage(lastPage, pages)
        : getNextMediaPageParam(lastPage, pages),
  });
}

export function viewAllItemLayoutType(type: string): 'series' | 'episode' {
  return type === 'latest' ? 'series' : 'episode';
}

export function normalizeRouteItemType(itemTypes?: MediaItemType): MediaItemType[] | undefined {
  return itemTypes ? [itemTypes] : undefined;
}

// Shared shape for the simple home rows (single fetch keyed by section name).
function homeSectionQueryOptions(
  section: string,
  currentServer: MediaServerInfo | null,
  fetch: (server: MediaServerInfo) => Promise<MediaItem[]>,
) {
  return queryOptions({
    gcTime: QUERY_CACHE_MAX_AGE_MS,
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey: mediaQueryKeys.homeSection(currentServer?.id, section),
    queryFn: async (): Promise<MediaItem[]> => (currentServer ? fetch(currentServer) : []),
    refetchOnWindowFocus: false,
    staleTime: HOME_SECTION_STALE_TIME_MS,
  });
}

type HomeWatchOptions = HomeLibraryScope & {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  limit?: number;
};

function homeWatchQueryOptions(
  section: 'resume' | 'nextup',
  { adapter, currentServer, libraryIds, queryClient, limit = 10 }: HomeWatchOptions,
) {
  return queryOptions({
    gcTime: QUERY_CACHE_MAX_AGE_MS,
    enabled: !!currentServer?.userId && libraryIds.length > 0,
    queryKey: mediaQueryKeys.homeVisibleSection(currentServer?.id, section, libraryIds, limit),
    queryFn: async ({ signal }): Promise<MediaItem[]> => {
      if (!currentServer || !libraryIds.length) return [];
      const result = await fetchVisibleHomePage({
        adapter,
        server: currentServer,
        scope: { libraryIds, queryClient },
        limit,
        signal,
        fetchPage: (startIndex, limit) =>
          section === 'resume'
            ? adapter.getResumeItems({ userId: currentServer.userId, startIndex, limit })
            : adapter.getNextUpItems({ userId: currentServer.userId, startIndex, limit }),
      });
      return result.items;
    },
    staleTime: HOME_SECTION_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function homeResumeQueryOptions(options: HomeWatchOptions) {
  return homeWatchQueryOptions('resume', options);
}

export function homeNextUpQueryOptions(options: HomeWatchOptions) {
  return homeWatchQueryOptions('nextup', options);
}

export function homeUserViewsQueryOptions({
  adapter,
  currentServer,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
}) {
  return homeSectionQueryOptions('allUserView', currentServer, async (server) => {
    const userView = await adapter.getUserView({ userId: server.userId });
    return (userView || []).filter((item) => item.collectionType !== 'playlists');
  });
}

export function homeLatestByFolderQueryOptions({
  adapter,
  currentServer,
  folderId,
  limit = 16,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  folderId: string;
  limit?: number;
}) {
  return queryOptions({
    gcTime: QUERY_CACHE_MAX_AGE_MS,
    enabled: !!currentServer?.id && !!currentServer?.userId,
    queryKey:
      limit === 16
        ? mediaQueryKeys.homeLatest(currentServer?.id, folderId)
        : [...mediaQueryKeys.homeLatest(currentServer?.id, folderId), { limit }],
    queryFn: async () => {
      if (!currentServer) return [];
      const response = await adapter.getLatestItemsByFolder({
        userId: currentServer.userId,
        folderId,
        limit,
      });
      return response.items;
    },
    refetchOnWindowFocus: false,
    staleTime: HOME_SECTION_STALE_TIME_MS,
  });
}

export function homeRandomQueryOptions({
  adapter,
  currentServer,
  libraryIds,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  libraryIds: string[];
}) {
  const folders = [...new Set(libraryIds)].filter(Boolean).sort();
  return queryOptions({
    gcTime: QUERY_CACHE_MAX_AGE_MS,
    enabled: !!currentServer?.userId && folders.length > 0,
    queryKey: mediaQueryKeys.homeRandom(currentServer?.id, folders),
    queryFn: async (): Promise<MediaItem[]> => {
      if (!currentServer?.userId || !folders.length) return [];
      // Query descendants of visible libraries on the server. A returned item's
      // immediate ParentId may be a nested folder, so client-side ID filtering
      // cannot reliably enforce library visibility.
      const pages: MediaItem[][] = new Array(folders.length);
      let nextFolder = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, folders.length) }, async () => {
          while (nextFolder < folders.length) {
            const index = nextFolder++;
            pages[index] = await adapter.getRandomItems({
              userId: currentServer.userId,
              folderId: folders[index],
              limit: 6,
            });
          }
        }),
      );
      const seen = new Set<string>();
      const items = pages.flat().filter((item) => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      // Avoid always filling the six slots from the first libraries in key order.
      for (let index = items.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [items[index], items[other]] = [items[other], items[index]];
      }
      return items.slice(0, 6);
    },
    refetchOnWindowFocus: false,
    staleTime: HOME_SECTION_STALE_TIME_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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
    gcTime: QUERY_CACHE_MAX_AGE_MS,
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

/** Refresh resume position before allocating a new playback session. */
export function playbackItemDetailQueryOptions(
  params: Parameters<typeof itemDetailQueryOptions>[0],
) {
  return {
    ...itemDetailQueryOptions(params),
    staleTime: 0,
    refetchOnMount: 'always' as const,
  };
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
  playbackAttempt = 0,
}: {
  adapter: MediaAdapter;
  currentServer: MediaServerInfo | null;
  item: MediaItem | null | undefined;
  keyOptions: StreamInfoKeyOptions;
  deviceProfile: unknown;
  deviceId: string;
  playbackAttempt?: number;
}) {
  const queryKey = mediaQueryKeys.streamInfo(
    currentServer?.id,
    item?.id,
    currentServer?.userId,
    keyOptions,
  );
  return queryOptions({
    enabled: !!currentServer?.userId && !!item,
    queryKey: playbackAttempt > 0 ? [...queryKey, 'load-attempt', playbackAttempt] : queryKey,
    queryFn: async () => {
      if (!currentServer?.userId || !item) return null;
      return await adapter.getStreamInfo({
        item,
        userId: currentServer.userId,
        deviceProfile,
        startTimeTicks: item.userData?.playbackPositionTicks || 0,
        deviceId,
        mediaSourceId: keyOptions.mediaSourceId,
        audioStreamIndex: keyOptions.audioStreamIndex,
        subtitleStreamIndex: keyOptions.subtitleStreamIndex,
        maxStreamingBitrate: keyOptions.enableTranscoding ? keyOptions.maxBitrate : undefined,
        alwaysBurnInSubtitleWhenTranscoding:
          keyOptions.enableTranscoding && keyOptions.enableSubtitleBurnIn,
      });
    },
    staleTime: 0,
    gcTime: 0,
    // PlaybackInfo allocates a session. Focus/reconnect must not replace a
    // currently playing source; explicit recovery requests a fresh session.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: undefined,
  });
}
