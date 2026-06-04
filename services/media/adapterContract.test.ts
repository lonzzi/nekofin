import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models';
import { describe, expect, it } from 'vitest';

import { convertEmbyItemToMediaItem, type EmbyBaseItemDto } from './emby/mappers';
import { convertBaseItemDtoToMediaItem } from './jellyfin/mappers';
import type { MediaItem } from './types';

type ContractCase = {
  name: string;
  jellyfin: BaseItemDto;
  emby: EmbyBaseItemDto;
  expected: Record<string, unknown>;
};

function withoutRaw(item: MediaItem): Omit<MediaItem, 'raw'> {
  const { raw, ...rest } = item;
  return rest;
}

const contractCases: ContractCase[] = [
  {
    name: 'movie detail',
    jellyfin: {
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
      OriginalTitle: 'Original Movie One',
      ProductionYear: 2026,
      PremiereDate: '2026-01-01T00:00:00.000Z',
      Overview: 'A movie overview.',
      CommunityRating: 8.5,
      CriticRating: 90,
      OfficialRating: 'PG-13',
      Genres: ['Animation', 'Drama'],
      GenreItems: [{ Name: 'Animation' }, { Name: 'Drama' }],
      Studios: [{ Name: 'Studio One' }],
      RunTimeTicks: 7_200_000_000,
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
    emby: {
      Id: 'movie-1',
      Name: 'Movie One',
      Type: 'Movie',
      OriginalTitle: 'Original Movie One',
      ProductionYear: 2026,
      Overview: 'A movie overview.',
      CommunityRating: 8.5,
      CriticRating: 90,
      OfficialRating: 'PG-13',
      Genres: ['Animation', 'Drama'],
      GenreItems: [{ Name: 'Animation' }, { Name: 'Drama' }],
      Studios: [{ Name: 'Studio One' }],
      RunTimeTicks: 7_200_000_000,
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
      overview: 'A movie overview.',
      communityRating: 8.5,
      criticRating: 90,
      officialRating: 'PG-13',
      genres: ['Animation', 'Drama'],
      genreItems: [{ name: 'Animation' }, { name: 'Drama' }],
      studios: [{ name: 'Studio One' }],
      runTimeTicks: 7_200_000_000,
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
    jellyfin: {
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
    emby: {
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
    jellyfin: {
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
    emby: {
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
];

describe('media adapter mapping contract', () => {
  it.each(contractCases)('normalizes $name consistently', ({ jellyfin, emby, expected }) => {
    expect(withoutRaw(convertBaseItemDtoToMediaItem(jellyfin))).toMatchObject(expected);
    expect(withoutRaw(convertEmbyItemToMediaItem(emby))).toMatchObject(expected);
  });

  it('uses stable fallback fields for sparse payloads', () => {
    expect(withoutRaw(convertBaseItemDtoToMediaItem({}))).toMatchObject({
      id: '',
      name: '',
      type: 'Other',
    });
    expect(withoutRaw(convertEmbyItemToMediaItem({}))).toMatchObject({
      id: '',
      name: '',
      type: 'Other',
    });
  });
});
