import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';

export const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const QUERY_CACHE_MAX_BYTES = 4 * 1024 * 1024;
export const QUERY_CACHE_MAX_QUERIES = 64;
const catalogKinds = new Set([
  'home',
  'folder-items',
  'view-all',
  'favorites',
  'detail-bundle',
  'item-detail',
  'episodes',
  'first-episode-by-season',
  'available-filters',
  'server-config',
]);

export function isCatalogQuery(key: readonly unknown[]) {
  return (
    key[0] === 'media' &&
    key[1] === 'server' &&
    typeof key[2] === 'string' &&
    catalogKinds.has(String(key[3]))
  );
}
export function shouldPersistQuery(query: Query) {
  return isCatalogQuery(query.queryKey) && defaultShouldDehydrateQuery(query);
}

/** Count UTF-8 bytes without allocating a second multi-megabyte buffer on Hermes. */
export function utf8Bytes(value: string) {
  let bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const volatileKeys = new Set([
  'accesstoken',
  'xembytoken',
  'apikey',
  'token',
  'password',
  'authorization',
  'playsessionid',
  'livestreamid',
  'directstreamurl',
  'transcodingurl',
  'deliveryurl',
  'mediasources',
  'mediastreams',
]);
function stripVolatileData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatileData);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !volatileKeys.has(key.replace(/[-_]/g, '').toLowerCase()))
        .map(([key, child]) => [key, stripVolatileData(child)]),
    );
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (
        url.username ||
        url.password ||
        [...url.searchParams.keys()].some((key) =>
          volatileKeys.has(key.replace(/[-_]/g, '').toLowerCase()),
        )
      )
        return undefined;
    } catch {
      return undefined;
    }
  }
  return value;
}

/** Persist a bounded recent catalog, never playback sessions, signed tracks or comment payloads. */
export function serializeQueryCache(client: PersistedClient) {
  const queries = client.clientState.queries
    .filter(
      (query) =>
        isCatalogQuery(query.queryKey) &&
        Date.now() - query.state.dataUpdatedAt < QUERY_CACHE_MAX_AGE_MS,
    )
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  const envelope = {
    timestamp: client.timestamp,
    buster: client.buster,
    clientState: { mutations: [], queries: [] },
  };
  const base = JSON.stringify(envelope);
  let bytes = utf8Bytes(base);
  const kept: string[] = [];
  for (const query of queries) {
    let data = query.state.data;
    if (
      data &&
      typeof data === 'object' &&
      'pages' in data &&
      'pageParams' in data &&
      Array.isArray(data.pages) &&
      Array.isArray(data.pageParams)
    )
      data = { ...data, pages: data.pages.slice(0, 2), pageParams: data.pageParams.slice(0, 2) };
    const encoded = JSON.stringify({
      ...query,
      state: { ...query.state, data: stripVolatileData(data) },
    });
    const size = utf8Bytes(encoded) + (kept.length ? 1 : 0);
    if (size > 512 * 1024 || bytes + size > QUERY_CACHE_MAX_BYTES) continue;
    kept.push(encoded);
    bytes += size;
    if (kept.length === QUERY_CACHE_MAX_QUERIES) break;
  }
  // Only replace the known empty array at the end; catalog payloads are already encoded once.
  return base.replace(/"queries":\[\](?=\}\}$)/, () => `"queries":[${kept.join(',')}]`);
}
