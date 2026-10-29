import { describe, expect, it } from 'vitest';

import { playerControlsReducer, type PlayerControlsState } from './playerControlsState';

describe('player controls lock', () => {
  it('hides controls and ignores attempts to reveal them until explicitly unlocked', () => {
    let state: PlayerControlsState = {
      isLocked: false,
      showControls: true,
      showLockControl: false,
    };
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: true });

    // These can arrive after the lock from taps, an open panel or VoiceOver.
    for (const visible of [true, false, true]) {
      state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible });
      expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: true });
    }

    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: false });
    expect(state).toEqual({ isLocked: false, showControls: true, showLockControl: false });
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: false });
    expect(state).toEqual({ isLocked: false, showControls: false, showLockControl: false });
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: true });
    expect(state).toEqual({ isLocked: false, showControls: true, showLockControl: false });
  });

  it('keeps the lock through auto-hide and repeated lock requests', () => {
    let state: PlayerControlsState = {
      isLocked: false,
      showControls: false,
      showLockControl: false,
    };
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    state = playerControlsReducer(state, { type: 'HIDE' });
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: false });
  });

  it('lets screen taps reveal and hide only the unlock button after auto-hide', () => {
    let state: PlayerControlsState = {
      isLocked: true,
      showControls: false,
      showLockControl: true,
    };
    state = playerControlsReducer(state, { type: 'HIDE' });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: false });

    state = playerControlsReducer(state, { type: 'TOGGLE_VISIBLE' });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: true });
    state = playerControlsReducer(state, { type: 'TOGGLE_VISIBLE' });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: false });

    // Late seek/panel callbacks must not reveal any controls after a screen tap.
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: true });
    expect(state).toEqual({ isLocked: true, showControls: false, showLockControl: false });

    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: false });
    expect(state).toEqual({ isLocked: false, showControls: true, showLockControl: false });
  });

  it('keeps normal screen taps and auto-hide working after unlocking', () => {
    let state: PlayerControlsState = {
      isLocked: true,
      showControls: false,
      showLockControl: true,
    };
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: false });
    state = playerControlsReducer(state, { type: 'TOGGLE_VISIBLE' });
    expect(state).toEqual({ isLocked: false, showControls: false, showLockControl: false });
    state = playerControlsReducer(state, { type: 'TOGGLE_VISIBLE' });
    expect(state).toEqual({ isLocked: false, showControls: true, showLockControl: false });
    state = playerControlsReducer(state, { type: 'HIDE' });
    expect(state).toEqual({ isLocked: false, showControls: false, showLockControl: false });
  });
});
