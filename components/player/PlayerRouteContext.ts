import { createContext } from 'react';

import type { createPlayerExitPreparation } from './playerExitPreparation';

type PlayerRouteContextValue = {
  entryVisible: boolean;
  isExiting: boolean;
  exitPreparation: ReturnType<typeof createPlayerExitPreparation> | null;
};

export const PlayerRouteContext = createContext<PlayerRouteContextValue>({
  entryVisible: true,
  isExiting: false,
  exitPreparation: null,
});
