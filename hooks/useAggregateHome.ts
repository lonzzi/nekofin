import type { GetMediaItemSource, MediaItemSource } from '@/components/media/mediaSource';
import { useHiddenUserViews } from '@/hooks/useHiddenUserViews';
import { useHomeCarouselLibraries } from '@/hooks/useHomeCarouselLibraries';
import { useRefetchOnScreenFocus } from '@/hooks/useRefetchOnScreenFocus';
import { useTranslation } from '@/lib/i18n';
import {
  groupAggregateLatestFolders,
  mergeAggregateHomeItems,
} from '@/services/media/aggregateHome';
import { homeCarouselLibraryIds, visibleHomeLibraryIds } from '@/services/media/homeVisibility';
import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import type { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { HomeSectionWithStatus } from './useHomeSections';
import { useMediaServerSources } from './useMediaServerSources';

const EMPTY_ITEMS: MediaItem[] = [];

// Query status changes on focus/refetch; retain presentation references while
// the catalog is unchanged so memoized rails and cards can skip that work.
function combineHomeQueries(queries: UseQueryResult<MediaItem[]>[]) {
  return {
    content: queries.map((query) => ({
      data: query.data ?? EMPTY_ITEMS,
      isLoading: query.isLoading,
      isError: query.isError,
    })),
    controls: queries.map((query) => ({
      isStale: query.isStale,
      isFetching: query.isFetching,
      refetch: query.refetch,
    })),
  };
}

export function useAggregateHome(servers: MediaServerInfo[]) {
  const { t: tr } = useTranslation();
  const sources = useMediaServerSources(servers);
  const hidden = useHiddenUserViews(servers.map((server) => server.id));
  const carouselLibraries = useHomeCarouselLibraries(servers.map((server) => server.id));
  const queryClient = useQueryClient();

  const libraryRequests = sources.map((source) => ({
    ...source,
    type: 'userview' as const,
    options: {
      ...homeUserViewsQueryOptions({ adapter: source.adapter, currentServer: source.server }),
      retry: 1,
    },
  }));
  const libraryQueries = useQueries({
    queries: libraryRequests.map((request) => request.options),
    combine: combineHomeQueries,
  });
  const libraryResults = useMemo(
    () =>
      sources.map((source, index) => ({
        ...source,
        type: 'userview' as const,
        query: libraryQueries.content[index],
      })),
    [sources, libraryQueries.content],
  );
  const librarySources = useMemo(
    () =>
      libraryResults.map(({ server, query }) => ({
        server,
        items: query.data.filter((item) => item.id && !hidden[server.id]?.includes(item.id)),
      })),
    [libraryResults, hidden],
  );
  const requests = sources.flatMap((source) =>
    [
      { type: 'resume' as const, options: homeResumeQueryOptions },
      { type: 'nextup' as const, options: homeNextUpQueryOptions },
    ].map(({ type, options }) => ({
      ...source,
      type,
      options: {
        ...options({
          adapter: source.adapter,
          currentServer: source.server,
          libraryIds: visibleHomeLibraryIds(
            librarySources.find(({ server }) => server.id === source.server.id)?.items,
          ),
          queryClient,
        }),
        retry: 1,
      },
    })),
  );
  const queries = useQueries({
    queries: requests.map((request) => request.options),
    combine: combineHomeQueries,
  });
  const sectionResults = useMemo(
    () => [
      ...libraryResults,
      ...sources.flatMap((source, index) => [
        { ...source, type: 'resume' as const, query: queries.content[index * 2] },
        { ...source, type: 'nextup' as const, query: queries.content[index * 2 + 1] },
      ]),
    ],
    [libraryResults, sources, queries.content],
  );
  const randomRequests = sources.map((source) => ({
    ...source,
    type: 'random' as const,
    options: {
      ...homeRandomQueryOptions({
        adapter: source.adapter,
        currentServer: source.server,
        libraryIds: homeCarouselLibraryIds(
          librarySources.find(({ server }) => server.id === source.server.id)?.items,
          hidden[source.server.id],
          carouselLibraries[source.server.id],
        ),
      }),
      retry: 1,
    },
  }));
  const randomQueries = useQueries({
    queries: randomRequests.map((request) => request.options),
    combine: combineHomeQueries,
  });
  const randomResults = useMemo(
    () =>
      sources.map((source, index) => ({
        ...source,
        type: 'random' as const,
        query: randomQueries.content[index],
      })),
    [sources, randomQueries.content],
  );
  const results = useMemo(
    () => [...sectionResults, ...randomResults],
    [sectionResults, randomResults],
  );
  const latestGroups = useMemo(
    () => groupAggregateLatestFolders(librarySources, hidden, tr),
    [librarySources, hidden, tr],
  );
  const latestRequests = useMemo(
    () =>
      latestGroups.flatMap((group) =>
        group.folders.map(({ server, folder }) => ({
          groupKey: group.key,
          server,
          folder,
          adapter: sources.find((source) => source.server.id === server.id)!.adapter,
        })),
      ),
    [latestGroups, sources],
  );
  const latestQueries = useQueries({
    queries: latestRequests.map(({ adapter, server, folder }) => ({
      ...homeLatestByFolderQueryOptions({ adapter, currentServer: server, folderId: folder.id! }),
      retry: 1,
    })),
    combine: combineHomeQueries,
  });
  const refetch = useCallback(
    () =>
      Promise.allSettled(
        [
          ...libraryQueries.controls,
          ...queries.controls,
          ...randomQueries.controls,
          ...latestQueries.controls,
        ].map((query) => query.refetch()),
      ),
    [libraryQueries.controls, queries.controls, randomQueries.controls, latestQueries.controls],
  );
  // Preserve the account home's random carousel when returning from a detail page.
  const focusQueries = [...libraryQueries.controls, ...queries.controls, ...latestQueries.controls];
  useRefetchOnScreenFocus({
    isEnabled: servers.length > 0,
    isStale: focusQueries.some((query) => query.isStale),
    fetchStatus: focusQueries.some((query) => query.isFetching) ? 'fetching' : 'idle',
    refetch: () =>
      Promise.allSettled(
        focusQueries.filter((query) => query.isStale).map((query) => query.refetch()),
      ),
  });

  const sourceByItem = useMemo(() => {
    const byServer = new Map(sources.map((source) => [source.server.id, source]));
    const byItem = new Map<MediaItem, MediaItemSource>();
    for (const { server, query } of results) {
      for (const item of query.data) byItem.set(item, byServer.get(server.id)!);
    }
    latestRequests.forEach(({ server }, index) => {
      for (const item of latestQueries.content[index].data)
        byItem.set(item, byServer.get(server.id)!);
    });
    return byItem;
  }, [sources, results, latestRequests, latestQueries.content]);
  const getItemSource: GetMediaItemSource = useCallback(
    (item) => sourceByItem.get(item),
    [sourceByItem],
  );
  const sections = useMemo(() => {
    const sections: HomeSectionWithStatus[] = ['resume', 'nextup'].map((type) => {
      const matches = sectionResults.filter((result) => result.type === type);
      return {
        key: type,
        type: type as 'resume' | 'nextup',
        title: type === 'resume' ? tr('home.continueWatching') : tr('home.upNext'),
        items: mergeAggregateHomeItems(
          matches.map(({ server, query }) => ({ server, items: query.data ?? [] })),
          'resume',
        ).map((entry) => entry.item),
        isLoading:
          matches.length > 0 &&
          matches.every(
            ({ server, query }) =>
              query.isLoading ||
              libraryResults.some(
                (result) => result.server.id === server.id && result.query.isLoading,
              ),
          ),
      };
    });
    sections.push({
      key: 'userview',
      type: 'userview',
      title: tr('media.libraries'),
      items: mergeAggregateHomeItems(librarySources, 'resume', Infinity).map((entry) => entry.item),
      isLoading:
        libraryResults
          .filter((result) => result.type === 'userview')
          .every((result) => result.query.isLoading) && sources.length > 0,
    });
    sections.push(
      ...latestGroups.map((group) => {
        const matches = latestRequests.flatMap((request, index) =>
          request.groupKey === group.key
            ? [{ ...request, query: latestQueries.content[index] }]
            : [],
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
    return sections;
  }, [
    sectionResults,
    libraryResults,
    librarySources,
    sources.length,
    latestGroups,
    latestRequests,
    latestQueries.content,
    tr,
  ]);
  const carouselItems = useMemo(
    () =>
      mergeAggregateHomeItems(
        randomResults.map(({ server, query }) => ({ server, items: query.data })),
        'resume',
        6,
      ).map((entry) => entry.item),
    [randomResults],
  );
  return {
    sources,
    sections,
    latestGroups,
    getItemSource,
    refetch,
    carouselItems,
    isCarouselLoading:
      randomResults.length > 0 &&
      randomResults.every(
        ({ server, query }) =>
          query.isLoading ||
          sectionResults.some(
            (result) =>
              result.type === 'userview' &&
              result.server.id === server.id &&
              result.query.isLoading,
          ),
      ),
    failedServers: [
      ...new Set(
        [
          ...results,
          ...latestRequests.map((request, index) => ({
            ...request,
            query: latestQueries.content[index],
          })),
        ]
          .filter(({ query }) => query.isError)
          .map(({ server }) => server.name),
      ),
    ],
  };
}
