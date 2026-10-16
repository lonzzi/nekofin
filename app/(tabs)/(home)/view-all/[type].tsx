import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import type { MediaItemSource } from '@/components/media/mediaSource';
import { useMediaServerSources } from '@/hooks/useMediaServerSources';
import { useRefetchOnScreenFocus } from '@/hooks/useRefetchOnScreenFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { getHiddenUserViews } from '@/lib/utils/userViewConfig';
import {
  groupAggregateLatestFolders,
  mergeAggregateHomeItems,
} from '@/services/media/aggregateHome';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { homeUserViewsQueryOptions } from '@/services/media/queryOptions';
import type { MediaItem } from '@/services/media/types';
import { useQueries } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function AggregateViewAllScreen() {
  const { type, sectionKey, serverId } = useLocalSearchParams<{
    type: string;
    sectionKey?: string;
    serverId?: string;
  }>();
  const { servers: allServers } = useMediaServers();
  const servers = useMemo(
    () => (serverId ? allServers.filter((server) => server.id === serverId) : allServers),
    [allServers, serverId],
  );
  const sources = useMediaServerSources(servers);
  const libraryQueries = useQueries({
    queries:
      type === 'latest'
        ? sources.map(({ server, adapter }) => ({
            ...homeUserViewsQueryOptions({ adapter, currentServer: server }),
            retry: 1,
          }))
        : [],
  });
  const groups = groupAggregateLatestFolders(
    sources.map(({ server }, index) => ({ server, items: libraryQueries[index]?.data ?? [] })),
    Object.fromEntries(servers.map((server) => [server.id, getHiddenUserViews(server.id)])),
  );
  const group = groups.find((group) => group.key === sectionKey);
  const requests =
    type === 'latest'
      ? (group?.folders ?? []).map(({ server, folder }) => ({
          ...sources.find((source) => source.server.id === server.id)!,
          folderId: folder.id!,
        }))
      : sources.map((source) => ({ ...source, folderId: undefined }));
  const queries = useQueries({
    queries: requests.map(({ server, adapter, folderId }) => ({
      queryKey: [...mediaQueryKeys.server(server.id), 'aggregate-view-all', type, folderId ?? ''],
      enabled: !!server.userId,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      queryFn: async () => {
        if (type === 'latest' && folderId)
          return (
            await adapter.getLatestItemsByFolder({ userId: server.userId, folderId, limit: 40 })
          ).items;
        const params = { userId: server.userId, limit: 40 };
        if (type === 'resume') return (await adapter.getResumeItems(params)).items;
        if (type === 'nextup') return (await adapter.getNextUpItems(params)).items;
        return [];
      },
    })),
  });
  const refetch = () =>
    Promise.allSettled([...queries, ...libraryQueries].map((query) => query.refetch()));
  useRefetchOnScreenFocus({
    isEnabled: requests.length > 0,
    isStale: queries.some((query) => query.isStale),
    fetchStatus: queries.some((query) => query.isFetching) ? 'fetching' : 'idle',
    refetch,
  });
  const entries = mergeAggregateHomeItems(
    requests.map(({ server }, index) => ({ server, items: queries[index].data ?? [] })),
    type === 'latest' ? 'latest' : 'resume',
    Infinity,
  );
  const sourceByItem = new Map<MediaItem, MediaItemSource>();
  requests.forEach((source, index) =>
    queries[index].data?.forEach((item) => sourceByItem.set(item, source)),
  );
  const isLoading =
    (type === 'latest' && !group && libraryQueries.some((query) => query.isLoading)) ||
    (queries.length > 0 && queries.every((query) => query.isLoading));
  return (
    <ItemGridScreen
      title={
        type === 'resume' ? '继续观看' : type === 'nextup' ? '接下来' : (group?.title ?? '最近添加')
      }
      data={entries.map((entry) => entry.item)}
      getItemSource={(item) => sourceByItem.get(item)}
      showServerSource={servers.length > 1}
      dataState={{
        isLoading: !!isLoading,
        isError:
          (queries.length > 0 && queries.every((query) => query.isError)) ||
          (type === 'latest' &&
            !group &&
            libraryQueries.length > 0 &&
            libraryQueries.every((query) => query.isError)),
        refetch,
      }}
      type={type === 'latest' ? 'series' : 'episode'}
      disableGrouping
    />
  );
}
