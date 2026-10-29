export type PlayerControlsState = {
  isLocked: boolean;
  showControls: boolean;
  showLockControl: boolean;
};

type PlayerControlsAction =
  | { type: 'SET_VISIBLE'; visible: boolean }
  | { type: 'TOGGLE_VISIBLE' }
  | { type: 'HIDE' }
  | { type: 'SET_LOCKED'; locked: boolean };

export function playerControlsReducer(
  state: PlayerControlsState,
  action: PlayerControlsAction,
): PlayerControlsState {
  switch (action.type) {
    case 'SET_VISIBLE':
      // Queued gestures, accessibility changes and panel callbacks must not
      // reveal controls until the user explicitly unlocks the player.
      return state.isLocked ? state : { ...state, showControls: action.visible };
    case 'TOGGLE_VISIBLE':
      return state.isLocked
        ? { ...state, showLockControl: !state.showLockControl }
        : { ...state, showControls: !state.showControls };
    case 'HIDE':
      return { ...state, showControls: false, showLockControl: false };
    case 'SET_LOCKED':
      if (state.isLocked === action.locked) return state;
      return {
        isLocked: action.locked,
        showControls: !action.locked,
        showLockControl: action.locked,
      };
  }
}
