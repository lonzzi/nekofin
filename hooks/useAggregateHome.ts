import type { GetMediaItemSource, MediaItemSource } from '@/components/media/mediaSource';
import { useRefetchOnScreenFocus } from '@/hooks/useRefetchOnScreenFocus';
import { getHiddenUserViews } from '@/lib/utils/userViewConfig';
import {
  groupAggregateLatestFolders,
  mergeAggregateHomeItems,
} from '@/services/media/aggregateHome';
import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { HomeSectionWithStatus } from './useHomeSections';
import { useMediaServerSources } from './useMediaServerSources';

export function useAggregateHome(servers: MediaServerInfo[]) {
  const sources = useMediaServerSources(servers);
  const [hidden, setHidden] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(servers.map((server) => [server.id, getHiddenUserViews(server.id)])),
  );
  useFocusEffect(
    useCallback(() => {
      const next = Object.fromEntries(
        servers.map((server) => [server.id, getHiddenUserViews(server.id)]),
      );
      setHidden((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }, [servers]),
  );

  const requests = sources.flatMap((source) =>
    [
      { type: 'resume' as const, options: homeResumeQueryOptions },
      { type: 'nextup' as const, options: homeNextUpQueryOptions },
      { type: 'userview' as const, options: homeUserViewsQueryOptions },
      { type: 'random' as const, options: homeRandomQueryOptions },
    ].map(({ type, options }) => ({
      ...source,
      type,
      options: { ...options({ adapter: source.adapter, currentServer: source.server }), retry: 1 },
    })),
  );
  const queries = useQueries({ queries: requests.map((request) => request.options) });
  const results = requests.map((request, index) => ({ ...request, query: queries[index] }));
  const librarySources = results
    .filter((result) => result.type === 'userview')
    .map(({ server, query }) => ({
      server,
      items: (query.data ?? []).filter((item) => item.id && !hidden[server.id]?.includes(item.id)),
    }));
  const latestGroups = groupAggregateLatestFolders(librarySources, hidden);
  const latestRequests = latestGroups.flatMap((group) =>
    group.folders.map(({ server, folder }) => ({
      groupKey: group.key,
      server,
      folder,
      adapter: sources.find((source) => source.server.id === server.id)!.adapter,
    })),
  );
  const latestQueries = useQueries({
    queries: latestRequests.map(({ adapter, server, folder }) => ({
      ...homeLatestByFolderQueryOptions({ adapter, currentServer: server, folderId: folder.id! }),
      retry: 1,
    })),
  });
  const allQueries = [...queries, ...latestQueries];
  const refetch = () => Promise.allSettled(allQueries.map((query) => query.refetch()));
  // Preserve the account home's random carousel when returning from a detail page.
  const focusQueries = [
    ...results.filter((result) => result.type !== 'random').map((result) => result.query),
    ...latestQueries,
  ];
  useRefetchOnScreenFocus({
    isEnabled: servers.length > 0,
    isStale: focusQueries.some((query) => query.isStale),
    fetchStatus: focusQueries.some((query) => query.isFetching) ? 'fetching' : 'idle',
    refetch: () =>
      Promise.allSettled(
        focusQueries.filter((query) => query.isStale).map((query) => query.refetch()),
      ),
  });

  const sourceByItem = new Map<MediaItem, MediaItemSource>();
  for (const { server, adapter, query } of results) {
    for (const item of query.data ?? []) sourceByItem.set(item, { server, adapter });
  }
  latestRequests.forEach(({ server, adapter }, index) => {
    for (const item of latestQueries[index].data ?? []) sourceByItem.set(item, { server, adapter });
  });
  const getItemSource: GetMediaItemSource = (item) => sourceByItem.get(item);
  const sections: HomeSectionWithStatus[] = ['resume', 'nextup'].map((type) => {
    const matches = results.filter((result) => result.type === type);
    return {
      key: type,
      type: type as 'resume' | 'nextup',
      title: type === 'resume' ? '继续观看' : '接下来',
      items: mergeAggregateHomeItems(
        matches.map(({ server, query }) => ({ server, items: query.data ?? [] })),
        'resume',
      ).map((entry) => entry.item),
      isLoading: matches.length > 0 && matches.every(({ query }) => query.isLoading),
    };
  });
  sections.push({
    key: 'userview',
    type: 'userview',
    title: '媒体库',
    items: mergeAggregateHomeItems(librarySources, 'resume', Infinity).map((entry) => entry.item),
    isLoading:
      results
        .filter((result) => result.type === 'userview')
        .every((result) => result.query.isLoading) && sources.length > 0,
  });
  sections.push(
    ...latestGroups.map((group) => {
      const matches = latestRequests.flatMap((request, index) =>
        request.groupKey === group.key ? [{ ...request, query: latestQueries[index] }] : [],
      );
      return {
        key: group.key,
        type: 'latest' as const,
        title: group.title,
        items: mergeAggregateHomeItems(
          matches.map(({ server, query }) => ({ server, items: query.data ?? [] })),
          'latest',
        ).map((entry) => entry.item),
        isLoading: matches.length > 0 && matches.every(({ query }) => query.isLoading),
      };
    }),
  );
  const randomResults = results.filter((result) => result.type === 'random');
  return {
    sources,
    sections,
    latestGroups,
    getItemSource,
    refetch,
    carouselItems: mergeAggregateHomeItems(
      randomResults.map(({ server, query }) => ({ server, items: query.data ?? [] })),
      'resume',
      6,
    ).map((entry) => entry.item),
    isCarouselLoading:
      randomResults.length > 0 && randomResults.every(({ query }) => query.isLoading),
    failedServers: [
      ...new Set(
        [
          ...results,
          ...latestRequests.map((request, index) => ({ ...request, query: latestQueries[index] })),
        ]
          .filter(({ query }) => query.isError)
          .map(({ server }) => server.name),
      ),
    ],
  };
}
