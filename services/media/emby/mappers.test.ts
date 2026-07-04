import { describe, expect, it } from 'vitest';

import { convertEmbyItemToMediaItem } from './mappers';

describe('convertEmbyItemToMediaItem', () => {
  it('maps Emby item payloads into the app media model', () => {
    const item = convertEmbyItemToMediaItem({
      Id: 'series-1',
      Name: 'Series One',
      Type: 'Series',
      Status: 'Continuing',
      Genres: ['Drama'],
      ProviderIds: {
        Tvdb: 'series-1',
      },
      ImageTags: {
        Primary: 'primary-tag',
      },
      BackdropImageTags: ['backdrop-tag'],
      ParentBackdropItemId: 'parent-1',
      ParentBackdropImageTags: ['parent-backdrop-tag'],
      Studios: [{ Name: 'Studio One' }],
      UserData: {
        Played: false,
        IsFavorite: true,
      },
    });

    expect(item).toMatchObject({
      id: 'series-1',
      name: 'Series One',
      type: 'Series',
      serverType: 'Series',
      status: 'Continuing',
      genres: ['Drama'],
      providerIds: {
        Tvdb: 'series-1',
      },
      imageTags: {
        Primary: 'primary-tag',
      },
      backdropImageTags: ['backdrop-tag'],
      parentBackdropItemId: 'parent-1',
      parentBackdropImageTags: ['parent-backdrop-tag'],
      studios: [{ name: 'Studio One' }],
      userData: {
        played: false,
        isFavorite: true,
      },
    });
  });

  it('keeps missing display fields stable', () => {
    const item = convertEmbyItemToMediaItem({});

    expect(item.id).toBe('');
    expect(item.name).toBe('');
    expect(item.type).toBe('Other');
    expect(item.serverType).toBeNull();
    expect(item.raw).toEqual({});
  });

  it('keeps known folder-like Emby types and preserves unknown server types', () => {
    expect(
      convertEmbyItemToMediaItem({
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
      convertEmbyItemToMediaItem({
        Id: 'custom-1',
        Name: 'Custom One',
        Type: 'CustomPluginItem',
      }),
    ).toMatchObject({
      id: 'custom-1',
      type: 'Other',
      serverType: 'CustomPluginItem',
    });
  });
});
