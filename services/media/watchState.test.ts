import { describe, expect, it } from 'vitest';

import { mapRawItemToMediaItem } from './mappers';
import type { MediaItem, MediaUserData } from './types';
import {
  getMediaUnplayedItemCount,
  isMediaItemPlayed,
  supportsMediaPlayedState,
} from './watchState';

function item(type: MediaItem['type'], userData?: MediaUserData | null): MediaItem {
  return { id: 'item-1', name: 'Neko', type, userData, raw: {} };
}

describe('media watched state', () => {
  it.each([
    'Series',
    'Season',
    'Movie',
    'Episode',
    'BoxSet',
    'Folder',
    'Video',
    'MusicVideo',
    'Recording',
    'Trailer',
    'AudioBook',
    'Book',
  ] as const)('recognizes a watched %s and a server reporting completion by percentage', (type) => {
    expect(isMediaItemPlayed(item(type, { played: true }))).toBe(true);
    expect(isMediaItemPlayed(item(type, { played: false, playedPercentage: 100 }))).toBe(true);
    expect(isMediaItemPlayed(item(type, { playedPercentage: 100 }))).toBe(true);
    expect(isMediaItemPlayed(item(type, { played: false, playedPercentage: 50 }))).toBe(false);
  });

  it.each(['Series', 'Season', 'BoxSet', 'Folder'] as const)(
    'shows the remaining count instead of completion when a %s has unwatched items',
    (type) => {
      const media = item(type, { played: true, playedPercentage: 100, unplayedItemCount: 3 });
      expect(getMediaUnplayedItemCount(media)).toBe(3);
      expect(isMediaItemPlayed(media)).toBe(false);
      // Empty folders and payloads without an aggregate played state are not completed.
      expect(isMediaItemPlayed(item(type, { unplayedItemCount: 0 }))).toBe(false);
    },
  );

  it.each([undefined, null, 0, -1, NaN, Infinity, 1.5])(
    'ignores missing, zero, and invalid remaining counts: %j',
    (count) => {
      expect(getMediaUnplayedItemCount(item('Series', { unplayedItemCount: count }))).toBeNull();
    },
  );

  it.each([
    'Photo',
    'PhotoAlbum',
    'Audio',
    'MusicArtist',
    'MusicAlbum',
    'CollectionFolder',
    'UserView',
    'Person',
    'TvChannel',
    'LiveTvChannel',
    'Program',
    'TvProgram',
    'LiveTvProgram',
    'Other',
  ] as const)('does not apply watched indicators to %s items', (type) => {
    const media = item(type, { played: true, playedPercentage: 100, unplayedItemCount: 3 });
    expect(supportsMediaPlayedState(media)).toBe(false);
    expect(getMediaUnplayedItemCount(media)).toBeNull();
    expect(isMediaItemPlayed(media)).toBe(false);
  });

  it('recognizes provider-specific video and book types while excluding live TV', () => {
    const media = item('Other', { played: true, unplayedItemCount: 3 });
    expect(isMediaItemPlayed({ ...media, mediaType: 'Video' })).toBe(true);
    expect(isMediaItemPlayed({ ...media, mediaType: 'Book' })).toBe(true);
    expect(getMediaUnplayedItemCount({ ...media, mediaType: 'Video' })).toBeNull();
    expect(isMediaItemPlayed({ ...media, type: 'TvChannel', mediaType: 'Video' })).toBe(false);
  });

  it.each([undefined, null, {}, { playedPercentage: NaN }, { playedPercentage: Infinity }])(
    'does not infer completion from missing or invalid user data: %j',
    (userData) => {
      expect(isMediaItemPlayed(item('Series', userData))).toBe(false);
    },
  );

  it('uses the optimistic state for the card menu', () => {
    const series = item('Series', { played: false, unplayedItemCount: 12 });
    expect(
      isMediaItemPlayed(series, { played: true, playedPercentage: 100, unplayedItemCount: 0 }),
    ).toBe(true);
    expect(isMediaItemPlayed(series, { played: false, playedPercentage: 0 })).toBe(false);
  });

  it('preserves series and season completion information from both server adapters', () => {
    const series = mapRawItemToMediaItem({
      Id: 'series-1',
      Type: 'Series',
      UserData: { Played: false, PlayedPercentage: 100, UnplayedItemCount: 0 },
    });
    const season = mapRawItemToMediaItem({
      Id: 'season-1',
      Type: 'Season',
      UserData: { Played: false, PlayedPercentage: 75, UnplayedItemCount: 3 },
    });
    expect(series.userData?.unplayedItemCount).toBe(0);
    expect(season.userData?.unplayedItemCount).toBe(3);
    expect(isMediaItemPlayed(series)).toBe(true);
    expect(isMediaItemPlayed(season)).toBe(false);
  });
});
