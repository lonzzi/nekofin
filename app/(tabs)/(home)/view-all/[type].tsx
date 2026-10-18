import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import type { MediaItemSource } from '@/components/media/mediaSource';
import { useHiddenUserViews } from '@/hooks/useHiddenUserViews';
import { useMediaServerSources } from '@/hooks/useMediaServerSources';
import { useRefetchOnScreenFocus } from '@/hooks/useRefetchOnScreenFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import {
  groupAggregateLatestFolders,
  mergeAggregateHomeItems,
} from '@/services/media/aggregateHome';
import { visibleHomeLibraryIds } from '@/services/media/homeVisibility';
import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaItem } from '@/services/media/types';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

export default function AggregateViewAllScreen() {
  const { type, sectionKey, serverId } = useLocalSearchParams<{
    type: string;
    sectionKey?: string;
    serverId?: string;
  }>();
  const { activeServers: allServers } = useMediaServers();
  const servers = useMemo(
    () => (serverId ? allServers.filter((server) => server.id === serverId) : allServers),
    [allServers, serverId],
  );
  const sources = useMediaServerSources(servers);
  const hidden = useHiddenUserViews(servers.map((server) => server.id));
  const queryClient = useQueryClient();
  const libraryQueries = useQueries({
    queries: sources.map(({ server, adapter }) => ({
      ...homeUserViewsQueryOptions({ adapter, currentServer: server }),
      retry: 1,
    })),
  });
  const groups = groupAggregateLatestFolders(
    sources.map(({ server }, index) => ({ server, items: libraryQueries[index]?.data ?? [] })),
    hidden,
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
    queries: requests.map(({ server, adapter, folderId }) => {
      const sourceIndex = sources.findIndex((source) => source.server.id === server.id);
      const scope = {
        libraryIds: visibleHomeLibraryIds(libraryQueries[sourceIndex]?.data, hidden[server.id]),
        queryClient,
      };
      if (type === 'resume' || type === 'nextup')
        return {
          ...(type === 'resume' ? homeResumeQueryOptions : homeNextUpQueryOptions)({
            adapter,
            currentServer: server,
            ...scope,
            limit: 40,
          }),
          retry: 1,
        };
      return {
        ...homeLatestByFolderQueryOptions({
          adapter,
          currentServer: server,
          folderId: folderId ?? '',
          limit: 40,
        }),
        retry: 1,
      };
    }),
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
    (requests.length === 0 && libraryQueries.some((query) => query.isLoading)) ||
    (libraryQueries.length > 0 && libraryQueries.every((query) => query.isLoading)) ||
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
          (libraryQueries.length > 0 && libraryQueries.every((query) => query.isError)),
        refetch,
      }}
      type={type === 'latest' ? 'series' : 'episode'}
      disableGrouping
    />
  );
}
