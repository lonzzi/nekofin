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
      status: 'Continuing',
      genres: ['Drama'],
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
    expect(item.raw).toEqual({});
  });
});
