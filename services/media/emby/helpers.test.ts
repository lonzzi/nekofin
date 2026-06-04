import { describe, expect, it } from 'vitest';

import {
  applyDefaultImageAndFields,
  convertSortByToEmby,
  getBlurHash,
  parseItems,
  parseItemsWithCount,
} from './helpers';

describe('Emby helpers', () => {
  it('applies default image and field request params', () => {
    const params = new URLSearchParams();

    applyDefaultImageAndFields(params);

    expect(params.get('Fields')).toBe(
      'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Path',
    );
    expect(params.get('ImageTypeLimit')).toBe('1');
    expect(params.get('EnableImageTypes')).toBe('Primary,Backdrop,Thumb');
  });

  it('normalizes item payloads into media items', async () => {
    await expect(
      parseItems({
        Items: [{ Id: 'movie-1', Name: 'Movie One', Type: 'Movie' }],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'movie-1',
        name: 'Movie One',
        type: 'Movie',
      }),
    ]);
  });

  it('normalizes paged item payloads into the adapter page contract', async () => {
    await expect(
      parseItemsWithCount({
        code: 200,
        msg: 'ok',
        data: {
          Items: [{ Id: 'series-1', Name: 'Series One', Type: 'Series' }],
          TotalRecordCount: 8,
        },
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'series-1',
          name: 'Series One',
          type: 'Series',
        }),
      ],
      total: 8,
    });
  });

  it('keeps sort keys provider-local and blurhash lookups defensive', () => {
    expect(convertSortByToEmby(['DateCreated', 'SortName'])).toEqual(['DateCreated', 'SortName']);
    expect(getBlurHash({ ImageBlurHashes: { Primary: 'hash-1' } } as never, 'Primary')).toBe(
      'hash-1',
    );
    expect(getBlurHash({ ImageBlurHashes: { Primary: { hash: 'bad' } } } as never, 'Primary')).toBe(
      undefined,
    );
  });
});
