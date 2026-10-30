import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { mediaQueryKeys } from './queryKeys';
import type { MediaUserData } from './types';

type UserDataUpdater = (current: MediaUserData | null | undefined) => MediaUserData | null;

const watchStateQueryKinds = new Set([
  'home',
  'folder-items',
  'view-all',
  'favorites',
  'detail-bundle',
  'episodes',
  'first-episode-by-season',
  'search',
]);

function containsServerWatchState(key: QueryKey, serverId: string) {
  if (key[0] !== 'media') return false;
  if (key[1] === 'aggregate-search') {
    return Array.isArray(key[2]) && key[2].includes(serverId);
  }
  return key[1] === 'server' && key[2] === serverId && watchStateQueryKinds.has(String(key[3]));
}

export async function invalidatePlaybackWatchState(client: QueryClient, serverId: string) {
  // Item-detail queries restore resume positions in the player. A delayed stop
  // may arrive after another episode has started, so defer all item-detail
  // refreshes until their next visit while refreshing catalog queries below.
  await client.invalidateQueries({
    queryKey: [...mediaQueryKeys.server(serverId), 'item-detail'],
    refetchType: 'none',
  });
  await client.invalidateQueries({
    predicate: ({ queryKey }) => containsServerWatchState(queryKey, serverId),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMediaItemLike(value: unknown, itemId: string): value is { userData?: MediaUserData } {
  return (
    isRecord(value) &&
    value.id === itemId &&
    typeof value.name === 'string' &&
    typeof value.type === 'string'
  );
}

function updateValue(
  value: unknown,
  itemId: string,
  updater: UserDataUpdater,
): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = updateValue(item, itemId, updater);
      changed ||= result.changed;
      return result.value;
    });
    return changed ? { value: next, changed } : { value, changed: false };
  }

  if (!isRecord(value)) {
    return { value, changed: false };
  }

  let nextValue: Record<string, unknown> | null = null;
  let changed = false;

  if (isMediaItemLike(value, itemId)) {
    nextValue = { ...value, userData: updater(value.userData) };
    changed = true;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === 'raw') continue;
    const result = updateValue(child, itemId, updater);
    if (!result.changed) continue;

    nextValue ??= { ...value };
    nextValue[key] = result.value;
    changed = true;
  }

  return changed ? { value: nextValue, changed } : { value, changed: false };
}

export function updateCachedMediaItemUserData<T>(
  data: T,
  itemId: string,
  updater: UserDataUpdater,
): T {
  return updateValue(data, itemId, updater).value as T;
}
