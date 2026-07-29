import { describe, expect, it } from 'vitest';

import {
  derivePlayerActionButtons,
  deriveTransportActions,
  getNormalizedSeekPosition,
  PLAYER_SEEK_INTERVAL_MS,
} from './playerControlModel';

describe('player control model', () => {
  it('keeps episode navigation and time controls in the expected transport order', () => {
    const actions = deriveTransportActions({
      durationMs: 30 * 60 * 1000,
      hasNextEpisode: true,
      hasPreviousEpisode: true,
      isMovie: false,
      isPlaying: true,
    });

    expect(actions.map((action) => action.key)).toEqual([
      'previousEpisode',
      'rewind10',
      'playPause',
      'forward10',
      'nextEpisode',
    ]);
    expect(actions.find((action) => action.key === 'playPause')?.accessibilityLabel).toBe('暂停');
    expect(actions.find((action) => action.key === 'rewind10')?.seekOffsetMs).toBe(
      -PLAYER_SEEK_INTERVAL_MS,
    );
    expect(actions.find((action) => action.key === 'forward10')?.seekOffsetMs).toBe(
      PLAYER_SEEK_INTERVAL_MS,
    );
  });

  it('omits episode navigation for movies and disables seeking without a duration', () => {
    expect(
      deriveTransportActions({
        durationMs: 0,
        hasNextEpisode: false,
        hasPreviousEpisode: false,
        isMovie: true,
        isPlaying: false,
      }),
    ).toEqual([
      {
        accessibilityLabel: '后退 10 秒',
        disabled: true,
        key: 'rewind10',
        seekOffsetMs: -PLAYER_SEEK_INTERVAL_MS,
      },
      {
        accessibilityLabel: '播放',
        disabled: false,
        key: 'playPause',
      },
      {
        accessibilityLabel: '前进 10 秒',
        disabled: true,
        key: 'forward10',
        seekOffsetMs: PLAYER_SEEK_INTERVAL_MS,
      },
    ]);
  });

  it('disables only unavailable episode boundaries', () => {
    const actions = deriveTransportActions({
      durationMs: 60_000,
      hasNextEpisode: true,
      hasPreviousEpisode: false,
      isMovie: false,
      isPlaying: false,
    });

    expect(actions.find((action) => action.key === 'previousEpisode')?.disabled).toBe(true);
    expect(actions.find((action) => action.key === 'nextEpisode')?.disabled).toBe(false);
  });

  it('keeps danmaku as a first-level action and omits an unavailable episode list', () => {
    expect(
      derivePlayerActionButtons({ danmakuCount: 128, episodeCount: 12, isMovie: false }).map(
        (action) => action.key,
      ),
    ).toEqual(['episodes', 'danmaku', 'tracks', 'playback']);

    expect(
      derivePlayerActionButtons({ danmakuCount: Number.NaN, episodeCount: 0, isMovie: false }),
    ).toEqual([
      { accessibilityLabel: '弹幕设置，当前 0 条', key: 'danmaku' },
      { accessibilityLabel: '字幕与音轨', key: 'tracks' },
      { accessibilityLabel: '播放设置', key: 'playback' },
    ]);
  });

  it('clamps time seeks and returns the normalized player position', () => {
    expect(
      getNormalizedSeekPosition({ currentTimeMs: 5_000, durationMs: 30_000, offsetMs: -10_000 }),
    ).toBe(0);
    expect(
      getNormalizedSeekPosition({ currentTimeMs: 25_000, durationMs: 30_000, offsetMs: 10_000 }),
    ).toBe(1);
    expect(
      getNormalizedSeekPosition({ currentTimeMs: 10_000, durationMs: 30_000, offsetMs: 10_000 }),
    ).toBeCloseTo(2 / 3);
    expect(
      getNormalizedSeekPosition({ currentTimeMs: 10_000, durationMs: 0, offsetMs: 10_000 }),
    ).toBeNull();
  });
});
