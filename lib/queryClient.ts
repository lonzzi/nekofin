import { QueryClient, type Query } from '@tanstack/react-query';

import { isCatalogQuery, QUERY_CACHE_MAX_QUERIES } from './queryCachePolicy';

export function createAppQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
        retryOnMount: true,
        structuralSharing: true,
      },
    },
  });
  const cache = client.getQueryCache();
  const lastUsed = new Map<Query, number>();
  let pruning = false;
  cache.subscribe((event) => {
    if (event.type === 'removed') {
      lastUsed.delete(event.query);
      return;
    }
    if (event.type === 'observerAdded' || event.type === 'observerRemoved')
      lastUsed.set(event.query, Date.now());
    if (pruning || (event.type !== 'updated' && event.type !== 'observerRemoved')) return;
    const catalog = cache.getAll().filter((query) => isCatalogQuery(query.queryKey));
    let excess = catalog.length - QUERY_CACHE_MAX_QUERIES;
    if (excess <= 0) return;
    pruning = true;
    try {
      const unused = catalog
        .filter((query) => query.getObserversCount() === 0 && query.state.fetchStatus === 'idle')
        .sort(
          (a, b) =>
            (lastUsed.get(a) ?? a.state.dataUpdatedAt) - (lastUsed.get(b) ?? b.state.dataUpdatedAt),
        );
      for (const query of unused) {
        if (excess-- <= 0) break;
        cache.remove(query);
      }
    } finally {
      pruning = false;
    }
  });
  return client;
}
