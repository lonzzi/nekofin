import { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  findEpisodeIndex,
  getDisplayEpisodes,
  getEpisodeHeaderText,
  getInitialSeasonId,
  getSeasonActions,
  getSeasonTitle,
  getSelectedEpisodeOrFallback,
} from './episodeSelection';

const item = (item: Partial<MediaItem>): MediaItem => ({
  id: 'item-1',
  name: 'Item',
  type: 'Episode',
  raw: {},
  ...item,
});

describe('episodeSelection', () => {
  it('selects the initial season from params before fallback seasons', () => {
    expect(getInitialSeasonId([item({ id: 'season-1' })], 'season-2')).toBe('season-2');
    expect(getInitialSeasonId([item({ id: 'season-1' })])).toBe('season-1');
    expect(getInitialSeasonId([])).toBe('');
  });

  it('chooses fetched season episodes when a season is selected', () => {
    const fallbackEpisodes = [item({ id: 'fallback' })];
    const currentSeasonEpisodes = [item({ id: 'current' })];

    expect(
      getDisplayEpisodes({
        selectedSeasonId: 'season-1',
        currentSeasonEpisodes,
        fallbackEpisodes,
      }),
    ).toBe(currentSeasonEpisodes);
    expect(
      getDisplayEpisodes({
        selectedSeasonId: '',
        currentSeasonEpisodes,
        fallbackEpisodes,
      }),
    ).toBe(fallbackEpisodes);
  });

  it('keeps selected episode when it exists and falls back otherwise', () => {
    const selectedEpisode = item({ id: 'episode-2' });
    const episodes = [item({ id: 'episode-1' }), selectedEpisode];

    expect(getSelectedEpisodeOrFallback(episodes, selectedEpisode)).toBe(selectedEpisode);
    expect(getSelectedEpisodeOrFallback(episodes, item({ id: 'missing' }))).toBe(episodes[0]);
    expect(getSelectedEpisodeOrFallback([], selectedEpisode)).toBe(selectedEpisode);
  });

  it('finds the selected episode index', () => {
    const episodes = [item({ id: 'episode-1' }), item({ id: 'episode-2' })];

    expect(findEpisodeIndex(episodes, 'episode-2')).toBe(1);
    expect(findEpisodeIndex(episodes, 'missing')).toBe(-1);
    expect(findEpisodeIndex(episodes)).toBe(-1);
  });

  it('formats season actions and episode header text', () => {
    const seasons = [item({ id: 'season-1', name: '', indexNumber: 1 }), item({ id: 'season-2' })];

    expect(getSeasonTitle(seasons[0])).toBe('第1季');
    expect(getSeasonTitle()).toBe('');
    expect(getSeasonActions(seasons, 'season-2')).toEqual([
      { id: 'season-1', title: '第1季', state: 'off' },
      { id: 'season-2', title: 'Item', state: 'on' },
    ]);
    expect(getEpisodeHeaderText(item({ seriesName: 'Series', indexNumber: 3 }))).toBe(
      'Series 第3集',
    );
  });

  it('does not render undefined episode or season numbers', () => {
    expect(getSeasonTitle(item({ name: '', indexNumber: undefined }))).toBe('未知季度');
    expect(getEpisodeHeaderText(item({ name: 'Episode Title', seriesName: 'Series' }))).toBe(
      'Series',
    );
    expect(getEpisodeHeaderText(item({ name: 'Episode Title', seriesName: '' }))).toBe(
      'Episode Title',
    );
  });
});
