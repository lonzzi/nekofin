import { resolveImageCandidate } from '@/lib/utils/imageCandidates';
import { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  formatUnplayedCount,
  getCardWatchStatusSuffix,
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
  it('keeps numeric badges compact and the full remaining count accessible', () => {
    expect(formatUnplayedCount(1)).toBe('1');
    expect(formatUnplayedCount(99)).toBe('99');
    expect(formatUnplayedCount(100)).toBe('99+');
    expect(formatUnplayedCount(205)).toBe('99+');
    expect(
      getCardWatchStatusSuffix(item({ type: 'Series', userData: { unplayedItemCount: 205 } })),
    ).toBe('，还有 205 集未看');
    expect(
      getCardWatchStatusSuffix(item({ type: 'Season', userData: { unplayedItemCount: 3 } })),
    ).toBe('，还有 3 集未看');
    expect(
      getCardWatchStatusSuffix(item({ type: 'BoxSet', userData: { unplayedItemCount: 3 } })),
    ).toBe('，还有 3 项未看');
    expect(getCardWatchStatusSuffix(item({ userData: { played: true } }))).toBe('，已观看');
    expect(getCardWatchStatusSuffix(item({ userData: {} }))).toBe('');
    expect(getCardWatchStatusSuffix(item({ type: 'Photo', userData: { played: true } }))).toBe('');
  });

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
      preferParentPoster: false,
      width: 400,
    });
  });

  it('uses a parent poster for portrait episode cards and a still for landscape cards', () => {
    const episode = {
      Id: 'episode-1',
      Type: 'Episode' as const,
      ImageTags: { Primary: 'still-tag' },
      PrimaryImageAspectRatio: 16 / 9,
      ParentPrimaryImageItemId: 'season-1',
      ParentPrimaryImageTag: 'season-poster-tag',
      SeriesId: 'series-1',
      SeriesPrimaryImageTag: 'series-poster-tag',
    };

    expect(resolveImageCandidate(episode, getImagePreferenceOptions('Primary'))).toMatchObject({
      imageType: 'Primary',
      imageTag: 'season-poster-tag',
      itemId: 'season-1',
      height: undefined,
    });
    expect(resolveImageCandidate(episode, getImagePreferenceOptions('Thumb'))).toMatchObject({
      imageType: 'Primary',
      imageTag: 'still-tag',
      itemId: 'episode-1',
      height: 225,
    });
    expect(
      resolveImageCandidate(episode, getImagePreferenceOptions('Primary', 'landscape')),
    ).toMatchObject({
      imageType: 'Primary',
      imageTag: 'still-tag',
      itemId: 'episode-1',
      height: 225,
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
