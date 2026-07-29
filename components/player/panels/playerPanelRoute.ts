export type PlayerTrackPanelTab = 'subtitle' | 'audio';

export type PlayerPanelRoute =
  | { key: 'episodes' }
  | { key: 'tracks'; tab?: PlayerTrackPanelTab }
  | { key: 'playback' }
  | { key: 'danmaku' }
  | { key: 'danmakuSearch'; animeId?: number };

export type PlayerPanelRootRoute = Exclude<PlayerPanelRoute, { key: 'danmakuSearch' }>;

export type PlayerPanelState = {
  stack: readonly PlayerPanelRoute[];
};

export type PlayerPanelAction =
  | { type: 'OPEN'; route: PlayerPanelRootRoute }
  | { type: 'PUSH'; route: PlayerPanelRoute }
  | { type: 'BACK' }
  | { type: 'CLOSE' };

export const INITIAL_PLAYER_PANEL_STATE: PlayerPanelState = { stack: [] };

export function playerPanelReducer(
  state: PlayerPanelState,
  action: PlayerPanelAction,
): PlayerPanelState {
  switch (action.type) {
    case 'OPEN':
      return { stack: [action.route] };
    case 'PUSH':
      return { stack: [...state.stack, action.route] };
    case 'BACK':
      return state.stack.length > 1
        ? { stack: state.stack.slice(0, -1) }
        : INITIAL_PLAYER_PANEL_STATE;
    case 'CLOSE':
      return INITIAL_PLAYER_PANEL_STATE;
  }
}

export function getActivePlayerPanelRoute(state: PlayerPanelState): PlayerPanelRoute | undefined {
  return state.stack.at(-1);
}

export function isPlayerPanelOpen(state: PlayerPanelState): boolean {
  return state.stack.length > 0;
}
