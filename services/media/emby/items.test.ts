import type { ApiClient } from '@/lib/request';
import { describe, expect, it, vi } from 'vitest';

import {
  getAllItemsByFolder,
  getFavoriteItemsPaged,
  getLatestItems,
  getLatestItemsByFolder,
  getRecommendedSearchKeywords,
} from './items';

const createClient = () =>
  ({
    get: vi.fn(async () => ({ code: 200, data: {}, msg: 'ok' })),
  }) as unknown as ApiClient & { get: ReturnType<typeof vi.fn> };

describe('emby items endpoints', () => {
  it('builds latest item params with filters and default image fields', async () => {
    const client = createClient();

    await getLatestItems(client, {
      userId: 'user-1',
      limit: 24,
      includeItemTypes: ['Movie', 'Series'],
      sortBy: ['DateCreated'],
      sortOrder: 'Descending',
      year: 2024,
      tags: ['anime', 'hdr'],
    });

    expect(client.get).toHaveBeenCalledWith('/Users/user-1/Items', {
      UserId: 'user-1',
      Recursive: true,
      Filters: 'IsNotFolder',
      Limit: 24,
      IncludeItemTypes: 'Movie,Series',
      SortBy: 'DateCreated',
      SortOrder: 'Descending',
      Years: 2024,
      Tags: 'anime,hdr',
      Fields: 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb',
    });
  });

  it('builds latest-by-folder params through the Emby Latest endpoint', async () => {
    const client = createClient();

    await getLatestItemsByFolder(client, {
      userId: 'user-1',
      folderId: 'folder-1',
      limit: 12,
    });

    expect(client.get).toHaveBeenCalledWith('/Users/user-1/Items/Latest', {
      Limit: 12,
      ParentId: 'folder-1',
      Fields: 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb',
    });
  });

  it('combines favorite and unplayed filters for paged favorites', async () => {
    const client = createClient();

    await getFavoriteItemsPaged(client, {
      userId: 'user-1',
      startIndex: 40,
      limit: 20,
      onlyUnplayed: true,
      sortBy: ['SortName'],
      sortOrder: 'Ascending',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/Users/user-1/Items',
      expect.objectContaining({
        StartIndex: 40,
        Limit: 20,
        Filters: 'IsFavorite,IsUnplayed',
        SortBy: 'SortName',
        SortOrder: 'Ascending',
      }),
    );
  });

  it('builds folder paging params with optional filters', async () => {
    const client = createClient();

    await getAllItemsByFolder(client, {
      userId: 'user-1',
      folderId: 'folder-1',
      startIndex: 80,
      limit: 40,
      itemTypes: ['Episode'],
      onlyUnplayed: true,
      year: 2023,
    });

    expect(client.get).toHaveBeenCalledWith(
      '/Users/user-1/Items',
      expect.objectContaining({
        ParentId: 'folder-1',
        StartIndex: 80,
        Limit: 40,
        IncludeItemTypes: 'Episode',
        Filters: 'IsUnplayed',
        Years: 2023,
      }),
    );
  });

  it('requests lightweight items for recommended search keywords', async () => {
    const client = createClient();

    await getRecommendedSearchKeywords(client, {
      userId: 'user-1',
      limit: 8,
    });

    expect(client.get).toHaveBeenCalledWith('/Users/user-1/Items', {
      UserId: 'user-1',
      Recursive: true,
      IncludeItemTypes: 'Movie,Series,MusicArtist',
      SortBy: 'IsFavoriteOrLiked,Random',
      ImageTypeLimit: 0,
      EnableTotalRecordCount: false,
      EnableImages: false,
      Limit: 8,
    });
  });
});
