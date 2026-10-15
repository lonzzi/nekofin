import { getImageInfo } from '@/lib/utils/image';
import { describe, expect, it, vi } from 'vitest';

import { mapRawItemToMediaItem } from '../mappers';
import { JellyfinAdapter } from './jellyfinAdapter';
import { parseJellyfinItemArrayResponse, parseJellyfinItemsPage } from './mappers';

const { reportStart, reportProgress, reportStop } = vi.hoisted(() => ({
  reportStart: vi.fn(),
  reportProgress: vi.fn(),
  reportStop: vi.fn(),
}));
vi.mock('@jellyfin/sdk/lib/utils/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jellyfin/sdk/lib/utils/api')>()),
  getPlaystateApi: () => ({
    reportPlaybackStart: reportStart,
    reportPlaybackProgress: reportProgress,
    reportPlaybackStopped: reportStop,
  }),
}));

describe('Jellyfin version playback reports', () => {
  it.each([
    ['reportPlaybackStart', reportStart, 'playbackStartInfo'],
    ['reportPlaybackProgress', reportProgress, 'playbackProgressInfo'],
    ['reportPlaybackStop', reportStop, 'playbackStopInfo'],
  ] as const)('includes the selected version in %s', async (method, report, field) => {
    const adapter = new JellyfinAdapter();
    adapter.setApi({ basePath: 'https://jellyfin.test' } as never);
    await adapter[method]({
      itemId: 'item-1',
      mediaSourceId: 'version-2',
      positionTicks: 1200,
      PlaySessionId: 'session-1',
    });
    expect(report).toHaveBeenLastCalledWith({
      [field]: expect.objectContaining({
        ItemId: 'item-1',
        MediaSourceId: 'version-2',
        PositionTicks: 12000000,
        PlaySessionId: 'session-1',
      }),
    });
  });
});

vi.mock('@/lib/utils/image', () => ({
  getImageInfo: vi.fn((_item, _opts, api) => ({
    url: api?.basePath,
    blurhash: undefined,
  })),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '26.0',
  },
}));

vi.mock('react-native-uuid', () => ({
  default: {
    v4: () => 'test-device-id',
  },
}));

vi.mock('react-native-mmkv', () => ({
  MMKV: class {
    private values = new Map<string, string>();

    getString(key: string) {
      return this.values.get(key);
    }

    set(key: string, value: string) {
      this.values.set(key, value);
    }
  },
}));

describe('mapRawItemToMediaItem', () => {
  it('maps core item fields and user data into the app media model', () => {
    const item = mapRawItemToMediaItem({
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
      ProductionYear: 2026,
      PrimaryImageAspectRatio: 0.666,
      Genres: ['Animation'],
      ProviderIds: {
        Imdb: 'tt123',
      },
      ImageTags: {
        Primary: 'primary-tag',
        Logo: 'logo-tag',
      },
      BackdropImageTags: ['backdrop-tag'],
      ParentBackdropItemId: 'series-1',
      ParentBackdropImageTags: ['parent-backdrop-tag'],
      SeriesPrimaryImageTag: 'series-primary-tag',
      UserData: {
        Played: true,
        IsFavorite: false,
        PlayedPercentage: 50,
        PlaybackPositionTicks: 123,
      },
      People: [
        {
          Id: 'person-1',
          Name: 'Actor One',
          Type: 'Composer',
          Role: 'Lead',
          PrimaryImageTag: 'tag-1',
        },
      ],
    });

    expect(item).toMatchObject({
      id: 'movie-1',
      name: 'Movie One',
      type: 'Movie',
      serverType: 'Movie',
      primaryImageAspectRatio: 0.666,
      productionYear: 2026,
      genres: ['Animation'],
      providerIds: {
        Imdb: 'tt123',
      },
      imageTags: {
        Primary: 'primary-tag',
        Logo: 'logo-tag',
      },
      backdropImageTags: ['backdrop-tag'],
      parentBackdropItemId: 'series-1',
      parentBackdropImageTags: ['parent-backdrop-tag'],
      seriesPrimaryImageTag: 'series-primary-tag',
      userData: {
        played: true,
        isFavorite: false,
        playedPercentage: 50,
        playbackPositionTicks: 123,
      },
      people: [
        {
          id: 'person-1',
          name: 'Actor One',
          type: 'Composer',
          serverType: 'Composer',
          role: 'Lead',
          primaryImageTag: 'tag-1',
        },
      ],
    });
  });

  it('falls back to stable defaults for missing required display fields', () => {
    const item = mapRawItemToMediaItem({});

    expect(item.id).toBe('');
    expect(item.name).toBe('');
    expect(item.type).toBe('Other');
    expect(item.serverType).toBeNull();
    expect(item.raw).toEqual({});
  });

  it('keeps known folder-like Jellyfin types and preserves unknown server types', () => {
    expect(
      mapRawItemToMediaItem({
        Id: 'view-1',
        Name: 'Movies',
        Type: 'CollectionFolder',
        CollectionType: 'movies',
      }),
    ).toMatchObject({
      id: 'view-1',
      type: 'CollectionFolder',
      serverType: 'CollectionFolder',
      collectionType: 'movies',
    });

    expect(
      mapRawItemToMediaItem({
        Id: 'custom-1',
        Name: 'Custom One',
        Type: 'CustomPluginItem' as never,
      }),
    ).toMatchObject({
      id: 'custom-1',
      type: 'Other',
      serverType: 'CustomPluginItem',
    });
  });

  it('maps paged Jellyfin responses into the adapter page contract', () => {
    expect(
      parseJellyfinItemsPage({
        data: {
          Items: [{ Id: 'movie-1', Name: 'Movie One', Type: 'Movie' }],
          TotalRecordCount: 12,
        },
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          id: 'movie-1',
          name: 'Movie One',
          type: 'Movie',
        }),
      ],
      total: 12,
    });
  });

  it('maps array Jellyfin responses into the adapter page contract', () => {
    expect(
      parseJellyfinItemArrayResponse({
        data: [{ Id: 'episode-1', Name: 'Episode One', Type: 'Episode' }],
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          id: 'episode-1',
          name: 'Episode One',
          type: 'Episode',
        }),
      ],
    });
  });
});

describe('JellyfinAdapter', () => {
  it('requires an adapter-bound api instance', async () => {
    await expect(new JellyfinAdapter().getSystemInfo()).rejects.toThrow('API instance is not set');
  });

  it('passes the adapter-bound api instance when resolving image info', () => {
    const adapter = new JellyfinAdapter();
    adapter.setApi({
      basePath: 'https://bound.jellyfin.test',
      accessToken: 'token',
    } as never);

    const imageInfo = adapter.getImageInfo({
      item: mapRawItemToMediaItem({
        Id: 'movie-1',
        Name: 'Movie One',
        Type: 'Movie',
        ImageTags: {
          Primary: 'tag-1',
        },
      }),
    });

    expect(imageInfo.url).toBe('https://bound.jellyfin.test');
    expect(getImageInfo).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'movie-1' }),
      undefined,
      expect.objectContaining({ basePath: 'https://bound.jellyfin.test' }),
    );
  });
});
