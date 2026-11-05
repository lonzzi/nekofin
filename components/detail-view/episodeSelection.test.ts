import { MediaItem } from '@/services/media/types';
import { describe, expect, it } from 'vitest';

import {
  findEpisodeIndex,
  getDisplayEpisodes,
  getEpisodeHeaderText,
  getEpisodeSeasonId,
  getInitialEpisodeChoice,
  getInitialEpisodeScrollIndex,
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
    expect(
      getInitialSeasonId([
        item({ id: 'specials', indexNumber: 0 }),
        item({ id: 'season-1', indexNumber: 1 }),
      ]),
    ).toBe('season-1');
  });

  it('opens the season containing the resume episode and respects explicit season links', () => {
    const seasons = [
      item({ id: 'season-1', indexNumber: 1 }),
      item({ id: 'season-2', indexNumber: 2 }),
    ];
    const episode = item({ id: 'episode-5', seasonId: 'season-2' });
    expect(getInitialEpisodeChoice(seasons, episode)).toEqual({
      seasonId: 'season-2',
      episodeId: 'episode-5',
    });
    expect(getInitialEpisodeChoice(seasons, episode, 'season-1')).toEqual({
      seasonId: 'season-1',
      episodeId: undefined,
    });
    expect(getEpisodeSeasonId(item({ parentIndexNumber: 2 }), seasons)).toBe('season-2');
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

  it('prefers an unfinished episode and refreshes the selected episode from new server data', () => {
    const watched = item({ id: 'episode-1', userData: { played: true } });
    const unplayed = item({ id: 'episode-2' });
    const resume = item({ id: 'episode-3', userData: { playbackPositionTicks: 300_000_000 } });
    expect(getSelectedEpisodeOrFallback([watched, unplayed, resume])).toBe(resume);
    expect(getSelectedEpisodeOrFallback([watched, unplayed])).toBe(unplayed);
    expect(getSelectedEpisodeOrFallback([watched, unplayed, resume], unplayed)).toBe(unplayed);
    expect(getSelectedEpisodeOrFallback([resume], item({ id: resume.id }))).toBe(resume);
    expect(getSelectedEpisodeOrFallback([])).toBeUndefined();
  });

  it('finds the selected episode index', () => {
    const episodes = [item({ id: 'episode-1' }), item({ id: 'episode-2' })];

    expect(findEpisodeIndex(episodes, 'episode-2')).toBe(1);
    expect(findEpisodeIndex(episodes, 'missing')).toBe(-1);
    expect(findEpisodeIndex(episodes)).toBe(-1);
  });

  it('renders the whole short season when all episodes fit on a tablet', () => {
    expect(
      getInitialEpisodeScrollIndex({
        selectedIndex: 1,
        episodeCount: 4,
        cardWidth: 200,
        gap: 12,
        horizontalPadding: 28,
        viewportWidth: 1219,
      }),
    ).toBe(0);
  });

  it('keeps preceding cards mounted when scrolling to the last episode is clamped', () => {
    const geometry = {
      episodeCount: 12,
      cardWidth: 200,
      gap: 12,
      horizontalPadding: 28,
      viewportWidth: 400,
    };
    expect(getInitialEpisodeScrollIndex({ ...geometry, selectedIndex: 11 })).toBe(10);
    expect(getInitialEpisodeScrollIndex({ ...geometry, selectedIndex: 5 })).toBe(5);
    expect(getInitialEpisodeScrollIndex({ ...geometry, selectedIndex: -1 })).toBe(0);
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
