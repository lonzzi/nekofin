import { getHiddenUserViews, subscribeToHiddenUserViews } from '@/lib/utils/userViewConfig';
import { useMemo, useSyncExternalStore } from 'react';

/** Share live per-account visibility with mounted single and aggregate homes. */
export function useHiddenUserViews(serverIds: string[]) {
  const getSnapshot = () =>
    JSON.stringify(Object.fromEntries(serverIds.map((id) => [id, getHiddenUserViews(id)])));
  const snapshot = useSyncExternalStore(subscribeToHiddenUserViews, getSnapshot, getSnapshot);
  return useMemo(() => JSON.parse(snapshot) as Record<string, string[]>, [snapshot]);
}
