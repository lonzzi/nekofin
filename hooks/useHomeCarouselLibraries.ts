import {
  getHomeCarouselLibraries,
  subscribeToHomeCarouselLibraries,
  type HomeCarouselLibraries,
} from '@/lib/utils/homeCarouselConfig';
import { useMemo, useSyncExternalStore } from 'react';

/** Keep mounted account and aggregate homes in sync with saved library choices. */
export function useHomeCarouselLibraries(serverIds: string[]) {
  const getSnapshot = () =>
    JSON.stringify(Object.fromEntries(serverIds.map((id) => [id, getHomeCarouselLibraries(id)])));
  const snapshot = useSyncExternalStore(subscribeToHomeCarouselLibraries, getSnapshot, getSnapshot);
  return useMemo(() => JSON.parse(snapshot) as Record<string, HomeCarouselLibraries>, [snapshot]);
}
