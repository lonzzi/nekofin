import { storage } from '@/lib/storage';

const HIDDEN_USERVIEWS_KEY_PREFIX = 'hiddenUserViews_';

export function subscribeToHiddenUserViews(onChange: () => void) {
  const listener = storage.addOnValueChangedListener((key) => {
    if (key.startsWith(HIDDEN_USERVIEWS_KEY_PREFIX)) onChange();
  });
  return () => listener.remove();
}

export function getHiddenUserViews(serverId: string): string[] {
  const key = `${HIDDEN_USERVIEWS_KEY_PREFIX}${serverId}`;
  const value = storage.getString(key);
  if (!value) return [];
  return JSON.parse(value) as string[];
}

export function setHiddenUserViews(serverId: string, userViewIds: string[]): void {
  const key = `${HIDDEN_USERVIEWS_KEY_PREFIX}${serverId}`;
  storage.set(key, JSON.stringify(userViewIds));
}

export function toggleUserViewHidden(serverId: string, userViewId: string, hidden: boolean): void {
  const hiddenIds = getHiddenUserViews(serverId);
  if (hidden) {
    if (!hiddenIds.includes(userViewId)) {
      setHiddenUserViews(serverId, [...hiddenIds, userViewId]);
    }
  } else {
    setHiddenUserViews(
      serverId,
      hiddenIds.filter((id) => id !== userViewId),
    );
  }
}
