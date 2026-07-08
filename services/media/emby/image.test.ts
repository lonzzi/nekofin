import { describe, expect, it, vi } from 'vitest';

import { mapRawItemToMediaItem } from '../mappers';
import { getEmbyImageInfo } from './image';

vi.mock('@/lib/utils', () => ({
  isNil: (value: unknown) => value == null,
}));

describe('getEmbyImageInfo', () => {
  const api = {
    basePath: 'https://emby.test',
    accessToken: 'token-1',
  };

  it('builds primary image urls from raw media items', () => {
    const item = mapRawItemToMediaItem({
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
      ImageTags: {
        Primary: 'primary-tag',
      },
    } as never);

    expect(getEmbyImageInfo({ api, item, opts: { width: 300 } })).toEqual({
      url: 'https://emby.test/Items/movie-1/Images/Primary?tag=primary-tag&maxWidth=300&quality=90',
      blurhash: undefined,
    });
  });

  it('returns an empty image result when the item has no usable image tag', () => {
    const item = mapRawItemToMediaItem({
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
    } as never);

    expect(getEmbyImageInfo({ api, item })).toEqual({
      url: undefined,
      blurhash: undefined,
    });
  });
});
