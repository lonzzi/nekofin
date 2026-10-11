import { mediaQueryKeys } from '@/services/media/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

export async function clearServerConnectionQueries(client: QueryClient, serverId: string) {
  const queryKey = mediaQueryKeys.server(serverId);
  const aggregateQueries = {
    queryKey: [...mediaQueryKeys.all, 'aggregate-search'],
    predicate: (query: { queryKey: readonly unknown[] }) =>
      Array.isArray(query.queryKey[2]) && query.queryKey[2].includes(serverId),
  };
  await Promise.all([client.cancelQueries({ queryKey }), client.cancelQueries(aggregateQueries)]);
  client.removeQueries({ queryKey });
  client.removeQueries(aggregateQueries);
}
