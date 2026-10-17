import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAvailableFilters,
  getEpisodesBySeason,
  getFavoriteItemsPaged,
  getItemAncestors,
  getLatestItems,
  getLatestItemsByFolder,
  getNextUpItems,
  getRandomItems,
  getResumeItems,
  searchItems,
} from './items';

const mocks = vi.hoisted(() => ({
  getItems: vi.fn(),
  getLatestMedia: vi.fn(),
  getQueryFiltersLegacy: vi.fn(),
  getResumeItems: vi.fn(),
  getNextUp: vi.fn(),
  getAncestors: vi.fn(),
}));

vi.mock('@jellyfin/sdk/lib/utils/api', () => ({
  getFilterApi: () => ({
    getQueryFiltersLegacy: mocks.getQueryFiltersLegacy,
  }),
  getItemsApi: () => ({
    getItems: mocks.getItems,
    getResumeItems: mocks.getResumeItems,
  }),
  getLibraryApi: () => ({ getAncestors: mocks.getAncestors }),
  getSearchApi: () => ({}),
  getTvShowsApi: () => ({ getNextUp: mocks.getNextUp }),
  getUserLibraryApi: () => ({ getLatestMedia: mocks.getLatestMedia }),
  getUserViewsApi: () => ({}),
}));

describe('Jellyfin item requests', () => {
  const api = {} as never;

  it('forwards raw paging cursors for both home watch endpoints', async () => {
    mocks.getResumeItems.mockResolvedValue({ data: { Items: [] } });
    mocks.getNextUp.mockResolvedValue({ data: { Items: [] } });
    await getResumeItems(api, 'user-1', 40, 80);
    await getNextUpItems(api, 'user-1', 40, 120);
    expect(mocks.getResumeItems).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', startIndex: 80, limit: 40 }),
    );
    expect(mocks.getNextUp).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', startIndex: 120, limit: 40 }),
    );
  });

  it('resolves library membership with the user-specific ancestor endpoint', async () => {
    mocks.getAncestors.mockResolvedValue({ data: [{ Id: 'visible' }] });
    expect(await getItemAncestors(api, 'user-1', 'series')).toEqual([{ Id: 'visible' }]);
    expect(mocks.getAncestors).toHaveBeenCalledWith({ userId: 'user-1', itemId: 'series' });
  });

  beforeEach(() => {
    mocks.getItems.mockReset();
    mocks.getLatestMedia.mockReset();
    mocks.getQueryFiltersLegacy.mockReset();
  });

  it('requests creation dates for chronological aggregation of library additions', async () => {
    mocks.getLatestMedia.mockResolvedValue({ data: [] });
    await getLatestItemsByFolder(api, 'user-1', 'library-1', 16);
    expect(mocks.getLatestMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        parentId: 'library-1',
        limit: 16,
        fields: expect.arrayContaining(['DateCreated']),
      }),
    );
  });

  it('includes series and creation dates in the latest items for aggregate home', async () => {
    mocks.getItems.mockResolvedValue({ data: { Items: [] } });
    await getLatestItems(api, 'user-1', 20, { includeItemTypes: ['Movie', 'Series'] });
    expect(mocks.getItems).toHaveBeenCalledWith(
      expect.objectContaining({
        includeItemTypes: ['Movie', 'Series'],
        filters: undefined,
        fields: ['DateCreated', 'PrimaryImageAspectRatio'],
        sortBy: ['DateCreated'],
        sortOrder: ['Descending'],
      }),
    );
  });

  it('enables background and logo metadata for the home carousel', async () => {
    mocks.getItems.mockResolvedValue({ data: { Items: [] } });

    await getRandomItems(api, 'user-1', 6);

    expect(mocks.getItems).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        limit: 6,
        includeItemTypes: ['Movie', 'Series'],
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb', 'Logo'],
        enableImages: true,
      }),
    );
  });

  it('scopes random carousel items recursively to the selected library', async () => {
    mocks.getItems.mockResolvedValue({ data: { Items: [] } });
    await getRandomItems(api, 'user-1', 6, 'visible-library');
    expect(mocks.getItems).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'visible-library', recursive: true, sortBy: ['Random'] }),
    );
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
