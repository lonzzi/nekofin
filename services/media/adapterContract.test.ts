import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import { describe, expect, it } from 'vitest';

import { mapRawItemToMediaItem } from './mappers';
import type { MediaItem } from './types';

// Jellyfin and Emby share one normalizer (`mapRawItemToMediaItem`) because both
// speak the same PascalCase `BaseItemDto` wire format. These cases are the spec
// for that shared mapping.
type MappingCase = {
  name: string;
  input: BaseItemDto;
  expected: Record<string, unknown>;
};

function withoutRaw(item: MediaItem): Omit<MediaItem, 'raw'> {
  const { raw, ...rest } = item;
  return rest;
}

const mappingCases: MappingCase[] = [
  {
    name: 'movie detail',
    input: {
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
      OriginalTitle: 'Original Movie One',
      ProductionYear: 2026,
      PremiereDate: '2026-01-01T00:00:00.000Z',
      DateCreated: '2026-01-02T00:00:00.000Z',
      Overview: 'A movie overview.',
      Taglines: ['A quiet little movie.'],
      Tags: ['anime', 'cozy'],
      CommunityRating: 8.5,
      CriticRating: 90,
      OfficialRating: 'PG-13',
      Genres: ['Animation', 'Drama'],
      GenreItems: [{ Name: 'Animation' }, { Name: 'Drama' }],
      ProductionLocations: ['Japan'],
      Studios: [{ Name: 'Studio One' }],
      RunTimeTicks: 7_200_000_000,
      CumulativeRunTimeTicks: 7_200_000_000,
      RecursiveItemCount: 1,
      ChildCount: 1,
      MediaSourceCount: 1,
      Container: 'mkv',
      UserData: {
        Played: true,
        PlayedPercentage: 100,
        IsFavorite: false,
        PlaybackPositionTicks: 0,
      },
      People: [
        {
          Id: 'person-1',
          Name: 'Actor One',
          Type: 'Actor',
          Role: 'Lead',
          PrimaryImageTag: 'person-tag',
        },
      ],
    },
    expected: {
      id: 'movie-1',
      name: 'Movie One',
      type: 'Movie',
      originalTitle: 'Original Movie One',
      productionYear: 2026,
      premiereDate: '2026-01-01T00:00:00.000Z',
      dateCreated: '2026-01-02T00:00:00.000Z',
      overview: 'A movie overview.',
      taglines: ['A quiet little movie.'],
      tags: ['anime', 'cozy'],
      communityRating: 8.5,
      criticRating: 90,
      officialRating: 'PG-13',
      genres: ['Animation', 'Drama'],
      genreItems: [{ name: 'Animation' }, { name: 'Drama' }],
      productionLocations: ['Japan'],
      studios: [{ name: 'Studio One' }],
      runTimeTicks: 7_200_000_000,
      cumulativeRunTimeTicks: 7_200_000_000,
      recursiveItemCount: 1,
      childCount: 1,
      mediaSourceCount: 1,
      container: 'mkv',
      userData: {
        played: true,
        playedPercentage: 100,
        isFavorite: false,
        playbackPositionTicks: 0,
      },
      people: [
        {
          id: 'person-1',
          name: 'Actor One',
          type: 'Actor',
          role: 'Lead',
          primaryImageTag: 'person-tag',
        },
      ],
    },
  },
  {
    name: 'series detail',
    input: {
      Id: 'series-1',
      Name: 'Series One',
      Type: 'Series',
      Status: 'Continuing',
      EndDate: null,
      ProductionYear: 2025,
      Genres: ['Sci-Fi'],
      UserData: {
        Played: false,
        IsFavorite: true,
      },
    },
    expected: {
      id: 'series-1',
      name: 'Series One',
      type: 'Series',
      status: 'Continuing',
      endDate: null,
      productionYear: 2025,
      genres: ['Sci-Fi'],
      userData: {
        played: false,
        playedPercentage: undefined,
        isFavorite: true,
        playbackPositionTicks: undefined,
      },
    },
  },
  {
    name: 'episode detail',
    input: {
      Id: 'episode-1',
      Name: 'Episode One',
      Type: 'Episode',
      SeriesName: 'Series One',
      SeriesId: 'series-1',
      SeasonId: 'season-1',
      ParentId: 'season-1',
      IndexNumber: 3,
      ParentIndexNumber: 1,
      Overview: 'An episode overview.',
      UserData: {
        Played: false,
        PlayedPercentage: 25,
        IsFavorite: false,
        PlaybackPositionTicks: 123_000,
      },
    },
    expected: {
      id: 'episode-1',
      name: 'Episode One',
      type: 'Episode',
      seriesName: 'Series One',
      seriesId: 'series-1',
      seasonId: 'season-1',
      parentId: 'season-1',
      indexNumber: 3,
      parentIndexNumber: 1,
      overview: 'An episode overview.',
      userData: {
        played: false,
        playedPercentage: 25,
        isFavorite: false,
        playbackPositionTicks: 123_000,
      },
    },
  },
  {
    name: 'collection folder',
    input: {
      Id: 'view-1',
      Name: 'Movies',
      Type: 'CollectionFolder',
      CollectionType: 'movies',
    },
    expected: {
      id: 'view-1',
      type: 'CollectionFolder',
      serverType: 'CollectionFolder',
      collectionType: 'movies',
    },
  },
];

describe('media adapter mapping contract', () => {
  it.each(mappingCases)('normalizes $name', ({ input, expected }) => {
    expect(withoutRaw(mapRawItemToMediaItem(input))).toMatchObject(expected);
  });

  it('uses stable fallback fields for sparse payloads', () => {
    const item = mapRawItemToMediaItem({});
    expect(withoutRaw(item)).toMatchObject({ id: '', name: '', type: 'Other' });
    expect(item.serverType).toBeNull();
    expect(item.raw).toEqual({});
  });

  it('preserves unknown server types as Other', () => {
    const item = mapRawItemToMediaItem({
      Id: 'custom-1',
      Type: 'CustomPluginItem',
    } as unknown as BaseItemDto);
    expect(withoutRaw(item)).toMatchObject({
      id: 'custom-1',
      type: 'Other',
      serverType: 'CustomPluginItem',
    });
  });
});
