import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  detailBundleQueryOptions,
  episodesBySeasonQueryOptions,
  favoritesQueryOptions,
  folderItemsQueryOptions,
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
  itemDetailQueryOptions,
  mediaSourcesQueryOptions,
  playbackItemDetailQueryOptions,
  streamInfoQueryOptions,
  viewAllQueryOptions,
} from './queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

const server: MediaServerInfo = {
  id: 'server-1',
  address: 'https://media.test',
  name: 'Media',
  userId: 'user-1',
  username: 'User One',
  userAvatar: '',
  accessToken: 'token-1',
  createdAt: 1,
  type: 'jellyfin',
};

const HOME_SECTION_STALE_TIME_MS = 60 * 1000;

describe('fresh playback resume metadata', () => {
  it('refreshes a fresh cached item before negotiating the next playback session', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const cached: MediaItem = {
      id: 'movie',
      name: 'Movie',
      type: 'Movie',
      raw: {},
      userData: { playbackPositionTicks: 0 },
    };
    const fresh = { ...cached, userData: { playbackPositionTicks: 6200000000 } };
    let resolveItem!: (item: MediaItem) => void;
    const adapter = createAdapter({
      getItemDetail: vi.fn(
        () =>
          new Promise<MediaItem>((resolve) => {
            resolveItem = resolve;
          }),
      ),
    });
    const options = playbackItemDetailQueryOptions({
      adapter,
      currentServer: server,
      itemId: cached.id,
    });
    client.setQueryData(options.queryKey, cached);
    const observer = new QueryObserver(client, options);
    let unsubscribe = () => {};
    try {
      const afterMount = new Promise<MediaItem>((resolve) => {
        unsubscribe = observer.subscribe((result) => {
          if (result.isFetchedAfterMount && result.data) resolve(result.data);
        });
      });
      expect(observer.getCurrentResult().isFetchedAfterMount).toBe(false);
      expect(adapter.getItemDetail).toHaveBeenCalledOnce();
      resolveItem(fresh);
      const item = await afterMount;
      const playback = streamInfoQueryOptions({
        adapter,
        currentServer: server,
        item,
        keyOptions: {
          enableTranscoding: false,
          maxBitrate: 1000000,
          enableSubtitleBurnIn: false,
          selectedCodec: 'h264',
        },
        deviceProfile: {},
        deviceId: 'device',
      });
      await playback.queryFn!({} as never);
      expect(adapter.getStreamInfo).toHaveBeenCalledWith(
        expect.objectContaining({ startTimeTicks: 6200000000 }),
      );
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});

function createAdapter(overrides: Partial<MediaAdapter> = {}) {
  return {
    getItemDetail: vi.fn(async () => ({
      id: 'item-1',
      name: 'Item One',
      type: 'Series' as const,
      raw: {},
      seriesId: 'series-1',
      parentId: 'season-1',
    })),
    getSeasonsBySeries: vi.fn(async () => ({ items: [{ id: 'season-1' }], total: 1 })),
    getNextUpItemsByFolder: vi.fn(async () => ({
      items: [{ id: 'nextup-folder-item' }],
      total: 1,
    })),
    getSimilarShows: vi.fn(async () => ({ items: [{ id: 'similar-show' }], total: 1 })),
    getEpisodesBySeason: vi.fn(async () => ({ items: [{ id: 'episode-1' }], total: 1 })),
    getSimilarMovies: vi.fn(async () => ({ items: [{ id: 'similar-movie' }], total: 1 })),
    getItemMediaSources: vi.fn(async () => ({ mediaSources: [{ id: 'source-1' }] })),
    getStreamInfo: vi.fn(async () => ({ url: 'https://stream.test', sessionId: 'session-1' })),
    getAllItemsByFolder: vi.fn(async () => ({ items: [{ id: 'folder-item' }], total: 10 })),
    getFavoriteItemsPaged: vi.fn(async () => ({ items: [{ id: 'favorite-item' }], total: 8 })),
    getItemAncestors: vi.fn(async () => [{ id: 'visible-library' }]),
    getResumeItems: vi.fn(async () => ({ items: [{ id: 'resume-item' }], total: 99 })),
    getNextUpItems: vi.fn(async () => ({ items: [{ id: 'nextup-item' }], total: 99 })),
    getLatestItemsByFolder: vi.fn(async () => ({
      items: [{ id: 'latest-folder-item' }],
      total: 99,
    })),
    getLatestItems: vi.fn(async () => ({ items: [{ id: 'latest-item' }], total: 99 })),
    ...overrides,
  } as unknown as MediaAdapter;
}

describe('media query options', () => {
  it('builds folder item options with offset pagination', async () => {
    const adapter = createAdapter();
    const options = folderItemsQueryOptions({
      adapter,
      currentServer: server,
      folderId: 'folder-1',
      filters: {
        includeItemTypes: ['Movie'],
        sortBy: ['DateCreated'],
        sortOrder: 'Descending',
      },
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'folder-items',
      'folder-1',
      {
        includeItemTypes: ['Movie'],
        sortBy: ['DateCreated'],
        sortOrder: 'Descending',
      },
    ]);

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({ pageParam: 20 } as never)).resolves.toEqual({
      items: [{ id: 'folder-item' }],
      total: 10,
    });
    expect(adapter.getAllItemsByFolder).toHaveBeenCalledWith(
      expect.objectContaining({
        startIndex: 20,
        limit: 60,
      }),
    );
  });

  it('builds favorites options with offset pagination', async () => {
    const adapter = createAdapter();
    const options = favoritesQueryOptions({
      adapter,
      currentServer: server,
      filters: { onlyUnplayed: true },
    });

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({ pageParam: 40 } as never)).resolves.toEqual({
      items: [{ id: 'favorite-item' }],
      total: 8,
    });
    expect(adapter.getFavoriteItemsPaged).toHaveBeenCalledWith(
      expect.objectContaining({
        startIndex: 40,
        limit: 40,
        onlyUnplayed: true,
      }),
    );
  });

  it('keeps non-paged view-all totals bounded to the loaded items', async () => {
    const adapter = createAdapter();
    const options = viewAllQueryOptions({
      adapter,
      currentServer: server,
      type: 'resume',
      filters: {},
      libraryIds: ['visible-library'],
      queryClient: new QueryClient(),
    });

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({ pageParam: 0 } as never)).resolves.toEqual({
      items: [{ id: 'resume-item' }],
      total: 1,
    });
  });

  it('builds home resume options', async () => {
    const adapter = createAdapter({
      getResumeItems: vi.fn(async () => ({
        items: [
          { id: 'home-resume-item', name: 'Home Resume Item', type: 'Movie' as const, raw: {} },
        ],
      })),
    });
    const options = homeResumeQueryOptions({
      adapter,
      currentServer: server,
      libraryIds: ['visible-library'],
      queryClient: new QueryClient(),
    });

    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'home',
      'resume',
      { libraryIds: ['visible-library'], limit: 10 },
    ]);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual([
      { id: 'home-resume-item', name: 'Home Resume Item', type: 'Movie', raw: {} },
    ]);
    expect(adapter.getResumeItems).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 10,
      startIndex: 0,
    });
  });

  it('builds home latest-by-folder options', async () => {
    const adapter = createAdapter();
    const options = homeLatestByFolderQueryOptions({
      adapter,
      currentServer: server,
      folderId: 'folder-1',
    });

    expect(options.queryKey).toEqual(['media', 'server', 'server-1', 'home', 'latest', 'folder-1']);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual([{ id: 'latest-folder-item' }]);
    expect(adapter.getLatestItemsByFolder).toHaveBeenCalledWith({
      userId: 'user-1',
      folderId: 'folder-1',
      limit: 16,
    });
  });

  it('keeps home sections fresh across quick detail back navigation', () => {
    const adapter = createAdapter();
    const homeOptions = [
      homeResumeQueryOptions({
        adapter,
        currentServer: server,
        libraryIds: ['visible-library'],
        queryClient: new QueryClient(),
      }),
      homeNextUpQueryOptions({
        adapter,
        currentServer: server,
        libraryIds: ['visible-library'],
        queryClient: new QueryClient(),
      }),
      homeUserViewsQueryOptions({ adapter, currentServer: server }),
      homeLatestByFolderQueryOptions({ adapter, currentServer: server, folderId: 'folder-1' }),
      homeRandomQueryOptions({ adapter, currentServer: server, libraryIds: ['library-1'] }),
    ];

    for (const options of homeOptions) {
      expect(options.staleTime).toBe(HOME_SECTION_STALE_TIME_MS);
      expect(options.refetchOnWindowFocus).toBe(false);
    }
  });

  it('builds series detail bundles', async () => {
    const adapter = createAdapter();
    const options = detailBundleQueryOptions({
      adapter,
      currentServer: server,
      mode: 'series',
      itemId: 'series-1',
    });

    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'detail-bundle',
      'series',
      'series-1',
    ]);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toMatchObject({
      item: { id: 'item-1' },
      seasons: [{ id: 'season-1' }],
      nextUpItems: [{ id: 'nextup-folder-item' }],
      similarShows: [{ id: 'similar-show' }],
    });
  });

  it('builds episode detail bundles from related series and season ids', async () => {
    const adapter = createAdapter();
    const options = detailBundleQueryOptions({
      adapter,
      currentServer: server,
      mode: 'episode',
      itemId: 'episode-1',
    });

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toMatchObject({
      item: { id: 'item-1' },
      seasons: [{ id: 'season-1' }],
      episodes: [{ id: 'episode-1' }],
      similarMovies: [{ id: 'similar-movie' }],
    });
    expect(adapter.getSeasonsBySeries).toHaveBeenCalledWith({
      seriesId: 'series-1',
      userId: 'user-1',
    });
    expect(adapter.getEpisodesBySeason).toHaveBeenCalledWith({
      seasonId: 'season-1',
      userId: 'user-1',
    });
  });

  it('builds item detail options', async () => {
    const adapter = createAdapter();
    const options = itemDetailQueryOptions({
      adapter,
      currentServer: server,
      itemId: 'item-1',
    });

    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'item-detail',
      'item-1',
      'user-1',
    ]);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toMatchObject({ id: 'item-1' });
    expect(adapter.getItemDetail).toHaveBeenCalledWith({
      itemId: 'item-1',
      userId: 'user-1',
    });
  });

  it('builds episodes-by-season options', async () => {
    const adapter = createAdapter();
    const options = episodesBySeasonQueryOptions({
      adapter,
      currentServer: server,
      seasonId: 'season-1',
    });

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual([{ id: 'episode-1' }]);
  });

  it('builds media sources options', async () => {
    const adapter = createAdapter();
    const options = mediaSourcesQueryOptions({
      adapter,
      currentServer: server,
      itemId: 'item-1',
    });

    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      mediaSources: [{ id: 'source-1' }],
    });
  });

  it('builds stream info options', async () => {
    const adapter = createAdapter();
    const item = {
      id: 'item-1',
      name: 'Item One',
      type: 'Movie' as const,
      raw: {},
      userData: {
        playbackPositionTicks: 123,
      },
    };
    const keyOptions = {
      enableTranscoding: true,
      maxBitrate: 8000000,
      enableSubtitleBurnIn: false,
      selectedCodec: 'h264',
      mediaSourceId: 'version-2',
      audioStreamIndex: 2,
      subtitleStreamIndex: -1,
    };
    const options = streamInfoQueryOptions({
      adapter,
      currentServer: server,
      item,
      keyOptions,
      deviceProfile: { profile: true },
      deviceId: 'device-1',
    });

    expect(options.queryKey).toEqual([
      'media',
      'server',
      'server-1',
      'stream-info',
      'item-1',
      'user-1',
      keyOptions,
    ]);
    expect(options.queryFn).toBeDefined();
    await expect(options.queryFn!({} as never)).resolves.toEqual({
      url: 'https://stream.test',
      sessionId: 'session-1',
    });
    expect(options.refetchOnWindowFocus).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
    expect(options.placeholderData).toBeUndefined();
    expect(adapter.getStreamInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        item,
        mediaSourceId: 'version-2',
        audioStreamIndex: 2,
        subtitleStreamIndex: -1,
        userId: 'user-1',
        startTimeTicks: 123,
        deviceId: 'device-1',
        maxStreamingBitrate: 8000000,
      }),
    );
  });

  it('isolates a new playback attempt without changing the selected version or tracks', async () => {
    const adapter = createAdapter();
    const args = {
      adapter,
      currentServer: server,
      item: { id: 'item-1', name: 'Item One', type: 'Movie' as const, raw: {} },
      keyOptions: {
        enableTranscoding: true,
        maxBitrate: 1000000,
        enableSubtitleBurnIn: false,
        selectedCodec: 'h264',
        mediaSourceId: 'version-2',
        audioStreamIndex: 2,
        subtitleStreamIndex: -1,
      },
      deviceProfile: {},
      deviceId: 'device-1',
    };
    const initial = streamInfoQueryOptions(args);
    const retry = streamInfoQueryOptions({ ...args, playbackAttempt: 1 });
    expect(retry.queryKey).toEqual([...initial.queryKey, 'load-attempt', 1]);
    await retry.queryFn!({} as never);
    expect(adapter.getStreamInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaSourceId: 'version-2',
        audioStreamIndex: 2,
        subtitleStreamIndex: -1,
      }),
    );
    expect(adapter.getStreamInfo).not.toHaveBeenCalledWith(
      expect.objectContaining({ playbackAttempt: 1 }),
    );
  });
});
