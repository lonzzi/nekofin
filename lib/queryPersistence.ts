import { storage } from '@/lib/storage';

export const QUERY_CACHE_BUSTER = 'media-cache-v2';
export const QUERY_CACHE_STORAGE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

export const queryPersistenceStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export function clearPersistedQueryCache() {
  storage.delete(QUERY_CACHE_STORAGE_KEY);
}

export function getPersistedQueryCacheBytes() {
  const raw = storage.getString(QUERY_CACHE_STORAGE_KEY);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw) as {
      clientState?: {
        mutations?: unknown[];
        queries?: unknown[];
      };
    };
    const queryCount = parsed.clientState?.queries?.length ?? 0;
    const mutationCount = parsed.clientState?.mutations?.length ?? 0;
    if (queryCount === 0 && mutationCount === 0) return 0;
  } catch {
    return raw.length;
  }

  return raw.length;
}

export function formatStorageBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
