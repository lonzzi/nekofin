import type { PropsWithChildren } from 'react';

import type { PlayerLabController } from './PlayerLabEntry.types';

export type { PlayerLabController } from './PlayerLabEntry.types';

export const PLAYER_LAB_AVAILABLE = false;

const noop = () => {};
const unavailableController: PlayerLabController = {
  available: PLAYER_LAB_AVAILABLE,
  close: noop,
  open: noop,
};

/**
 * Production and preview builds resolve this inert implementation. Metro only
 * considers the development implementation when APP_VARIANT=development.
 */
export function PlayerLabHost({ children }: PropsWithChildren) {
  return children;
}

export function usePlayerLab(): PlayerLabController {
  return unavailableController;
}
