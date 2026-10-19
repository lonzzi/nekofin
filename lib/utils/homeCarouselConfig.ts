import { storage } from '@/lib/storage';

const KEY_PREFIX = 'homeCarouselLibraries_';

/** null follows all visible libraries; [] explicitly opts the account out. */
export type HomeCarouselLibraries = string[] | null;

export function getHomeCarouselLibraries(serverId: string): HomeCarouselLibraries {
  const value = storage.getString(`${KEY_PREFIX}${serverId}`);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string' && id.length > 0)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function setHomeCarouselLibraries(serverId: string, ids: HomeCarouselLibraries): void {
  const key = `${KEY_PREFIX}${serverId}`;
  if (ids === null) storage.delete(key);
  else storage.set(key, JSON.stringify([...new Set(ids)].filter(Boolean).sort()));
}

export function setHomeCarouselLibraryEnabled(
  serverId: string,
  libraryId: string,
  enabled: boolean,
  visibleIds: string[],
) {
  // Read the latest value so rapid native toggle events cannot overwrite each other.
  const next = new Set(getHomeCarouselLibraries(serverId) ?? visibleIds);
  if (enabled) next.add(libraryId);
  else next.delete(libraryId);
  setHomeCarouselLibraries(serverId, [...next]);
}

export function subscribeToHomeCarouselLibraries(onChange: () => void) {
  const listener = storage.addOnValueChangedListener((key) => {
    if (key.startsWith(KEY_PREFIX)) onChange();
  });
  return () => listener.remove();
}
