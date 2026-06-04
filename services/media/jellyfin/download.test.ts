import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getJellyfinItemDownloadUrl,
  getJellyfinSeasonDownloadMap,
  getJellyfinSeriesDownloadMap,
} from './download';

const getItems = vi.fn();
const getSeasons = vi.fn();

vi.mock('@jellyfin/sdk/lib/utils/api/items-api', () => ({
  getItemsApi: () => ({
    getItems,
  }),
}));

vi.mock('@jellyfin/sdk/lib/utils/api/tv-shows-api', () => ({
  getTvShowsApi: () => ({
    getSeasons,
  }),
}));

describe('getJellyfinItemDownloadUrl', () => {
  it('builds download urls from the explicit api instance', () => {
    expect(
      getJellyfinItemDownloadUrl(
        {
          basePath: 'https://jellyfin.test',
          accessToken: 'token-1',
        } as never,
        'item-1',
      ),
    ).toBe('https://jellyfin.test/Items/item-1/Download?api_key=token-1');
  });

  it('returns undefined without an access token', () => {
    expect(
      getJellyfinItemDownloadUrl(
        {
          basePath: 'https://jellyfin.test',
          accessToken: undefined,
        } as never,
        'item-1',
      ),
    ).toBeUndefined();
  });
});

describe('Jellyfin download maps', () => {
  const api = {
    basePath: 'https://jellyfin.test',
    accessToken: 'token-1',
  } as never;

  beforeEach(() => {
    getItems.mockReset();
    getSeasons.mockReset();
  });

  it('builds a season episode download map from an explicit api instance', async () => {
    getItems.mockResolvedValue({
      data: {
        Items: [
          { Id: 'episode-1', Name: 'Episode One' },
          { Id: 'episode-2', Name: undefined },
          { Id: undefined, Name: 'Missing Id' },
        ],
      },
    });

    const map = await getJellyfinSeasonDownloadMap(api, 'season-1', 'user-1');

    expect(getItems).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        parentId: 'season-1',
      }),
    );
    expect([...map.entries()]).toEqual([
      ['Episode One', 'https://jellyfin.test/Items/episode-1/Download?api_key=token-1'],
    ]);
  });

  it('combines season download maps for a series', async () => {
    getSeasons.mockResolvedValue({
      data: {
        Items: [{ Id: 'season-1' }, { Id: 'season-2' }],
      },
    });
    getItems
      .mockResolvedValueOnce({
        data: {
          Items: [{ Id: 'episode-1', Name: 'Episode One' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          Items: [{ Id: 'episode-2', Name: 'Episode Two' }],
        },
      });

    const map = await getJellyfinSeriesDownloadMap(api, 'series-1', 'user-1');

    expect(getSeasons).toHaveBeenCalledWith({
      userId: 'user-1',
      seriesId: 'series-1',
    });
    expect([...map.entries()]).toEqual([
      ['Episode One', 'https://jellyfin.test/Items/episode-1/Download?api_key=token-1'],
      ['Episode Two', 'https://jellyfin.test/Items/episode-2/Download?api_key=token-1'],
    ]);
  });
});
