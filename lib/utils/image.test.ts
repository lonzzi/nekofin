import { Api } from '@jellyfin/sdk';
import { ImageType } from '@jellyfin/sdk/lib/generated-client';
import { describe, expect, it } from 'vitest';

import { getImageInfo, getItemImageUrl, getLogo } from './image';

const api = new Api(
  'https://media.example/jellyfin',
  { name: 'NekoFin', version: 'test' },
  { name: 'test', id: 'test-device' },
);

describe('image request cache identity', () => {
  it('changes the backdrop cache URL when server artwork changes', () => {
    const item = { Id: 'movie', BackdropImageTags: ['first-version'] };
    const first = getImageInfo(item, { preferBackdrop: true, width: 1080 }, api);
    const updated = getImageInfo(
      { ...item, BackdropImageTags: ['second-version'] },
      { preferBackdrop: true, width: 1080 },
      api,
    );
    expect(new URL(first.url!).searchParams.get('tag')).toBe('first-version');
    expect(new URL(updated.url!).searchParams.get('tag')).toBe('second-version');
    expect(updated.url).not.toBe(first.url);
    expect(new URL(first.url!).searchParams.get('maxWidth')).toBe('1080');
  });

  it('uses the inherited backdrop owner and its tag together', () => {
    const info = getImageInfo(
      { Id: 'episode', ParentBackdropItemId: 'series', ParentBackdropImageTags: ['series-art'] },
      { preferBackdrop: true },
      api,
    );
    const url = new URL(info.url!);
    expect(url.pathname).toBe('/jellyfin/Items/series/Images/Backdrop');
    expect(url.searchParams.get('tag')).toBe('series-art');
  });

  it('versions inherited transparent logos without changing their format', () => {
    const info = getLogo(api, {
      Id: 'episode',
      ParentLogoItemId: 'series',
      ParentLogoImageTag: 'logo-v2',
    });
    const url = new URL(info.url!);
    expect(url.pathname).toBe('/jellyfin/Items/series/Images/Logo');
    expect(url.searchParams.get('tag')).toBe('logo-v2');
    expect(url.searchParams.get('format')).toBe('Webp');
  });

  it('honors an explicit format rather than overwriting it with the default', () => {
    const url = getItemImageUrl(api, 'movie', ImageType.Backdrop, { format: 'Png' });
    expect(new URL(url).searchParams.get('format')).toBe('Png');
  });
});
