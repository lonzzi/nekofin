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
  let bytes = value.length;
  // Index UTF-16 units directly: iterating code points allocates a temporary
  // string for every character, which stalls Hermes on the catalog cache.
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit < 0x80) continue;
    if (unit < 0x800) {
      bytes += 1;
      continue;
    }
    bytes += 2;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index++;
    }
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
function* queryCacheChunks(client: PersistedClient): Generator<void, string> {
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
    if (size <= 512 * 1024 && bytes + size <= QUERY_CACHE_MAX_BYTES) {
      kept.push(encoded);
      bytes += size;
      if (kept.length === QUERY_CACHE_MAX_QUERIES) break;
    }
    yield;
  }
  // Only replace the known empty array at the end; catalog payloads are already encoded once.
  return base.replace(/"queries":\[\](?=\}\}$)/, () => `"queries":[${kept.join(',')}]`);
}

export function serializeQueryCache(client: PersistedClient) {
  const chunks = queryCacheChunks(client);
  let step = chunks.next();
  while (!step.done) step = chunks.next();
  return step.value;
}

/** Keep optional disk persistence out of navigation, yielding between catalog entries. */
export async function serializeQueryCacheAsync(
  client: PersistedClient,
  yieldControl: () => Promise<void>,
) {
  await yieldControl();
  const chunks = queryCacheChunks(client);
  let started = performance.now();
  for (;;) {
    const step = chunks.next();
    if (step.done) return step.value;
    if (performance.now() - started >= 4) {
      await yieldControl();
      started = performance.now();
    }
  }
}
