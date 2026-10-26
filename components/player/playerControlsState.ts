export type PlayerControlsState = {
  isLocked: boolean;
  showControls: boolean;
};

type PlayerControlsAction =
  | { type: 'SET_VISIBLE'; visible: boolean }
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
    case 'SET_LOCKED':
      return { isLocked: action.locked, showControls: !action.locked };
  }
}
