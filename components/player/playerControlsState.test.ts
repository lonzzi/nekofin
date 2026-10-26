import { describe, expect, it } from 'vitest';

import { playerControlsReducer, type PlayerControlsState } from './playerControlsState';

describe('player controls lock', () => {
  it('hides controls and ignores attempts to reveal them until explicitly unlocked', () => {
    let state: PlayerControlsState = { isLocked: false, showControls: true };
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    expect(state).toEqual({ isLocked: true, showControls: false });

    // These can arrive after the lock from taps, an open panel or VoiceOver.
    for (const visible of [true, false, true]) {
      state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible });
      expect(state).toEqual({ isLocked: true, showControls: false });
    }

    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: false });
    expect(state).toEqual({ isLocked: false, showControls: true });
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: false });
    expect(state).toEqual({ isLocked: false, showControls: false });
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: true });
    expect(state).toEqual({ isLocked: false, showControls: true });
  });

  it('keeps the lock through auto-hide and repeated lock requests', () => {
    let state: PlayerControlsState = { isLocked: false, showControls: false };
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    state = playerControlsReducer(state, { type: 'SET_VISIBLE', visible: false });
    state = playerControlsReducer(state, { type: 'SET_LOCKED', locked: true });
    expect(state).toEqual({ isLocked: true, showControls: false });
  });
});
