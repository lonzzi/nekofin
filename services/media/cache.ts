import type { MediaUserData } from './types';

type UserDataUpdater = (current: MediaUserData | null | undefined) => MediaUserData | null;

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
