import { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
  getSubtitle,
} from './cardHelpers';

const item = (item: Partial<MediaItem>): MediaItem => ({
  id: 'item-1',
  name: 'Neko',
  type: 'Movie',
  raw: {},
  ...item,
});

describe('cardHelpers', () => {
  it('formats episode subtitles with season and episode numbers', () => {
    expect(
      getSubtitle(
        item({
          type: 'Episode',
          parentIndexNumber: 2,
          indexNumber: 8,
          name: 'A Sunny Day',
        }),
      ),
    ).toBe('S2E8 - A Sunny Day');

    expect(getSubtitle(item({ type: 'Episode', name: 'Special' }))).toBe('Special');
  });

  it('formats movie and series subtitles', () => {
    expect(getSubtitle(item({ type: 'Movie', productionYear: 2024 }))).toBe(2024);
    expect(getSubtitle(item({ type: 'Movie', productionYear: null }))).toBe('未知时间');
    expect(getSubtitle(item({ type: 'Series', productionYear: 2020, status: 'Continuing' }))).toBe(
      '2020 - 现在',
    );
    expect(
      getSubtitle(item({ type: 'Series', productionYear: 2020, endDate: '2022-03-01T00:00:00Z' })),
    ).toBe('2020 - 2022');
    expect(
      getSubtitle(item({ type: 'Series', productionYear: 2020, endDate: '2020-03-01T00:00:00Z' })),
    ).toBe('2020');
  });

  it('builds image preference options from image type', () => {
    expect(getImagePreferenceOptions('Thumb')).toEqual({
      preferBackdrop: false,
      preferThumb: true,
      preferBanner: false,
      preferLogo: false,
      width: 400,
    });
  });

  it('builds routes for episode cards', () => {
    expect(getEpisodeCardRoute(item({ type: 'Movie', id: 'movie-1' }))).toEqual({
      pathname: '/movie/[id]',
      params: { id: 'movie-1' },
    });
    expect(
      getEpisodeCardRoute(item({ type: 'Episode', id: 'ep-1', seasonId: 'season-1' })),
    ).toEqual({
      pathname: '/episode',
      params: { episodeId: 'ep-1', seasonId: 'season-1' },
    });
    expect(getEpisodeCardRoute(item({ type: 'Episode', id: '' }))).toBeNull();
  });

  it('builds routes for series cards', () => {
    expect(getSeriesCardRoute(item({ type: 'Season', id: 'season-1' }))).toEqual({
      pathname: '/episode',
      params: { seasonId: 'season-1' },
    });
    expect(getSeriesCardRoute(item({ type: 'Episode', id: 'ep-1', seriesId: 'series-1' }))).toEqual(
      {
        pathname: '/series/[id]',
        params: { id: 'series-1' },
      },
    );
    expect(getSeriesCardRoute(item({ type: 'Movie', id: 'movie-1' }))).toEqual({
      pathname: '/movie/[id]',
      params: { id: 'movie-1' },
    });
    expect(getSeriesCardRoute(item({ type: 'Other', id: 'other-1' }))).toBeNull();
  });
});
