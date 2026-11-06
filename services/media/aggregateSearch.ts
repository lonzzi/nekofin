import type { UseQueryResult } from '@tanstack/react-query';

import { searchItemsQueryOptions } from './queryOptions';
import type { MediaAdapter, MediaItem, MediaServerInfo } from './types';

type SearchSource = {
  server: MediaServerInfo;
  adapter: Pick<MediaAdapter, 'searchItems'>;
};

type SearchQuery = Pick<
  UseQueryResult<MediaItem[]>,
  'data' | 'isPending' | 'isFetching' | 'isError'
>;
const EMPTY_ITEMS: MediaItem[] = [];

export function aggregateSearchQueries({
  sources,
  keyword,
}: {
  sources: SearchSource[];
  keyword: string;
}) {
  const searchTerm = keyword.trim();
  if (!searchTerm) return [];
  return sources.map(({ server, adapter }) =>
    searchItemsQueryOptions({ adapter, currentServer: server, keyword: searchTerm, limit: 60 }),
  );
}

export function aggregateSearchResults<Source extends SearchSource>(
  sources: Source[],
  queries: SearchQuery[],
) {
  return {
    groups: sources.map((source, index) => ({
      source,
      items: queries[index]?.data ?? EMPTY_ITEMS,
    })),
    failedServers: sources.flatMap(({ server }, index) =>
      queries[index]?.isError ? [server.name] : [],
    ),
    pendingServerCount: queries.filter((query) => query.isPending || query.isFetching).length,
    isLoading: queries.length > 0 && queries.every((query) => query.isPending),
  };
}
