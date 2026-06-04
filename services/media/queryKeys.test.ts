import { describe, expect, it } from 'vitest';

import { mediaQueryKeys } from './queryKeys';

describe('mediaQueryKeys', () => {
  it('scopes keys under the current media server', () => {
    expect(mediaQueryKeys.server('server-a')).toEqual(['media', 'server', 'server-a']);
    expect(mediaQueryKeys.server(undefined)).toEqual(['media', 'server', null]);
  });

  it('keeps filter objects in paged list keys', () => {
    const filters = {
      includeItemTypes: ['Series' as const, 'Movie' as const],
      sortBy: ['DatePlayed' as const, 'DateCreated' as const],
      sortOrder: 'Descending' as const,
      onlyUnplayed: true,
      year: 2026,
      tags: ['z', 'anime'],
    };

    expect(mediaQueryKeys.folderItems('server-a', 'folder-a', filters)).toEqual([
      'media',
      'server',
      'server-a',
      'folder-items',
      'folder-a',
      {
        includeItemTypes: ['Movie', 'Series'],
        sortBy: ['DatePlayed', 'DateCreated'],
        sortOrder: 'Descending',
        onlyUnplayed: true,
        year: 2026,
        tags: ['anime', 'z'],
      },
    ]);
  });

  it('omits undefined and empty filter fields from list keys', () => {
    expect(
      mediaQueryKeys.favorites('server-a', {
        includeItemTypes: [],
        sortBy: undefined,
        sortOrder: undefined,
        onlyUnplayed: false,
        year: undefined,
        tags: [],
      }),
    ).toEqual(['media', 'server', 'server-a', 'favorites', {}]);
  });

  it('normalizes optional ids to null instead of undefined', () => {
    expect(mediaQueryKeys.detailBundle('server-a', 'movie', undefined)).toEqual([
      'media',
      'server',
      'server-a',
      'detail-bundle',
      'movie',
      null,
    ]);
  });

  it('scopes player stream keys by server, item, user, and playback options', () => {
    const options = {
      enableTranscoding: true,
      maxBitrate: 8000000,
      enableSubtitleBurnIn: false,
      selectedCodec: 'h264',
    };

    expect(mediaQueryKeys.streamInfo('server-a', 'item-a', 'user-a', options)).toEqual([
      'media',
      'server',
      'server-a',
      'stream-info',
      'item-a',
      'user-a',
      options,
    ]);
  });
});
