import { describe, expect, it } from 'vitest';

import {
  getActivePlayerPanelRoute,
  INITIAL_PLAYER_PANEL_STATE,
  isPlayerPanelOpen,
  playerPanelReducer,
} from './playerPanelRoute';

describe('player panel route reducer', () => {
  it('opens a root panel and replaces any previously open stack', () => {
    const episodesState = playerPanelReducer(INITIAL_PLAYER_PANEL_STATE, {
      type: 'OPEN',
      route: { key: 'episodes' },
    });
    const tracksState = playerPanelReducer(episodesState, {
      type: 'OPEN',
      route: { key: 'tracks', tab: 'audio' },
    });

    expect(tracksState).toEqual({ stack: [{ key: 'tracks', tab: 'audio' }] });
    expect(getActivePlayerPanelRoute(tracksState)).toEqual({ key: 'tracks', tab: 'audio' });
    expect(isPlayerPanelOpen(tracksState)).toBe(true);
  });

  it('pushes a nested route and backs up to its parent', () => {
    const danmakuState = playerPanelReducer(INITIAL_PLAYER_PANEL_STATE, {
      type: 'OPEN',
      route: { key: 'danmaku' },
    });
    const searchState = playerPanelReducer(danmakuState, {
      type: 'PUSH',
      route: { key: 'danmakuSearch', animeId: 42 },
    });

    expect(searchState).toEqual({
      stack: [{ key: 'danmaku' }, { key: 'danmakuSearch', animeId: 42 }],
    });
    expect(getActivePlayerPanelRoute(searchState)).toEqual({
      key: 'danmakuSearch',
      animeId: 42,
    });
    expect(playerPanelReducer(searchState, { type: 'BACK' })).toEqual(danmakuState);
  });

  it('closes a root panel when navigating back', () => {
    const state = playerPanelReducer(INITIAL_PLAYER_PANEL_STATE, {
      type: 'OPEN',
      route: { key: 'playback' },
    });
    const closedState = playerPanelReducer(state, { type: 'BACK' });

    expect(closedState).toBe(INITIAL_PLAYER_PANEL_STATE);
    expect(getActivePlayerPanelRoute(closedState)).toBeUndefined();
    expect(isPlayerPanelOpen(closedState)).toBe(false);
  });

  it('closes an entire nested stack explicitly', () => {
    const state = {
      stack: [{ key: 'danmaku' }, { key: 'danmakuSearch' }] as const,
    };

    expect(playerPanelReducer(state, { type: 'CLOSE' })).toBe(INITIAL_PLAYER_PANEL_STATE);
  });

  it('supports pushing the first route without mutating the initial state', () => {
    const state = playerPanelReducer(INITIAL_PLAYER_PANEL_STATE, {
      type: 'PUSH',
      route: { key: 'danmakuSearch' },
    });

    expect(state).toEqual({ stack: [{ key: 'danmakuSearch' }] });
    expect(INITIAL_PLAYER_PANEL_STATE).toEqual({ stack: [] });
  });
});
