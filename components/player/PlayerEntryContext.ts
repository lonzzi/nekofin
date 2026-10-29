import { createContext } from 'react';

import type { createPlayerExitPreparation } from './playerExitPreparation';

export const PlayerEntryVisibilityContext = createContext(true);

export const PlayerExitPreparationContext = createContext<ReturnType<
  typeof createPlayerExitPreparation
> | null>(null);
