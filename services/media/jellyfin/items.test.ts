import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAvailableFilters,
  getEpisodesBySeason,
  getFavoriteItemsPaged,
  searchItems,
} from './items';

const mocks = vi.hoisted(() => ({
  getItems: vi.fn(),
  getQueryFiltersLegacy: vi.fn(),
}));

vi.mock('@jellyfin/sdk/lib/utils/api', () => ({
  getFilterApi: () => ({
    getQueryFiltersLegacy: mocks.getQueryFiltersLegacy,
  }),
  getItemsApi: () => ({
    getItems: mocks.getItems,
    getResumeItems: vi.fn(),
  }),
  getLibraryApi: () => ({}),
  getSearchApi: () => ({}),
  getTvShowsApi: () => ({}),
  getUserLibraryApi: () => ({}),
  getUserViewsApi: () => ({}),
}));

describe('Jellyfin item requests', () => {
  const api = {} as never;

  beforeEach(() => {
    mocks.getItems.mockReset();
    mocks.getQueryFiltersLegacy.mockReset();
  });

  it('builds paged favorite requests with optional filters', async () => {
    mocks.getItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });

    await getFavoriteItemsPaged(api, 'user-1', 40, 20, {
      includeItemTypes: ['Movie'],
      sortBy: ['SortName'],
      sortOrder: 'Ascending',
      onlyUnplayed: true,
      year: 2026,
      tags: ['anime'],
    });

    expect(mocks.getItems).toHaveBeenCalledWith({
      userId: 'user-1',
      startIndex: 40,
      limit: 20,
      sortBy: ['SortName'],
      sortOrder: ['Ascending'],
      fields: ['PrimaryImageAspectRatio', 'Path'],
      imageTypeLimit: 1,
      enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
      filters: ['IsFavorite', 'IsUnplayed'],
      recursive: true,
      includeItemTypes: ['Movie'],
      years: [2026],
      tags: ['anime'],
    });
  });

  it('returns raw search items with a stable empty fallback', async () => {
    mocks.getItems.mockResolvedValueOnce({
      data: {
        Items: [{ Id: 'movie-1', Name: 'Movie One' }],
      },
    });
    await expect(searchItems(api, 'user-1', 'movie')).resolves.toEqual([
      { Id: 'movie-1', Name: 'Movie One' },
    ]);

    mocks.getItems.mockResolvedValueOnce({ data: undefined });
    await expect(searchItems(api, 'user-1', 'missing')).resolves.toEqual([]);
  });

  it('builds episode-by-season requests with the season as parent id', async () => {
    mocks.getItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });

    await getEpisodesBySeason(api, 'season-1', 'user-1');

    expect(mocks.getItems).toHaveBeenCalledWith({
      userId: 'user-1',
      parentId: 'season-1',
      includeItemTypes: ['Episode'],
      recursive: false,
      sortBy: ['IndexNumber'],
      sortOrder: ['Ascending'],
      fields: [
        'ItemCounts',
        'PrimaryImageAspectRatio',
        'CanDelete',
        'MediaSourceCount',
        'Overview',
      ],
      imageTypeLimit: 1,
      enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
    });
  });

  it('normalizes available filters from Jellyfin responses', async () => {
    mocks.getQueryFiltersLegacy.mockResolvedValue({
      data: {
        Years: [2024, 'bad', 2026],
        Tags: ['anime', 1],
        Genres: ['Drama', null],
      },
    });

    await expect(getAvailableFilters(api, 'user-1', 'folder-1')).resolves.toEqual({
      years: [2024, 2026],
      tags: ['anime'],
      genres: ['Drama'],
    });
  });
});
