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

  it('requests parent artwork for portrait episodes while preserving landscape stills', () => {
    const item = mapRawItemToMediaItem({
      Id: 'episode-1',
      Type: 'Episode',
      ImageTags: { Primary: 'still-tag' },
      ParentPrimaryImageItemId: 'season-1',
      ParentPrimaryImageTag: 'poster-tag',
    });

    expect(
      getEmbyImageInfo({ api, item, opts: { preferParentPoster: true, width: 400 } }).url,
    ).toBe(
      'https://emby.test/Items/season-1/Images/Primary?tag=poster-tag&maxWidth=400&quality=90',
    );
    expect(getEmbyImageInfo({ api, item, opts: { preferThumb: true, width: 400 } }).url).toBe(
      'https://emby.test/Items/episode-1/Images/Primary?tag=still-tag&maxWidth=400&quality=90',
    );
  });
});
