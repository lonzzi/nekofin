import type { MediaItemSource } from '@/components/media/mediaSource';
import { useTranslation } from '@/lib/i18n';
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
import type { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useHiddenUserViews } from './useHiddenUserViews';
import { useMediaServerSources } from './useMediaServerSources';
import { useRefetchOnScreenFocus } from './useRefetchOnScreenFocus';

const EMPTY_ITEMS: MediaItem[] = [];

function combineQueries(queries: UseQueryResult<MediaItem[]>[]) {
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

/** Retain card data and account sources through focus/refetch status changes. */
export function useAggregateViewAll({
  servers,
  type,
  sectionKey,
}: {
  servers: MediaServerInfo[];
  type: string;
  sectionKey?: string;
}) {
  const { t: tr } = useTranslation();
  const sources = useMediaServerSources(servers);
  const hidden = useHiddenUserViews(servers.map((server) => server.id));
  const queryClient = useQueryClient();
  const libraries = useQueries({
    queries: sources.map(({ server, adapter }) => ({
      ...homeUserViewsQueryOptions({ adapter, currentServer: server }),
      retry: 1,
    })),
    combine: combineQueries,
  });
  const groups = useMemo(
    () =>
      groupAggregateLatestFolders(
        sources.map(({ server }, index) => ({
          server,
          items: libraries.content[index].data,
        })),
        hidden,
        tr,
      ),
    [sources, libraries.content, hidden, tr],
  );
  const group = groups.find((entry) => entry.key === sectionKey);
  const requests = useMemo(
    () =>
      type === 'latest'
        ? (group?.folders ?? []).map(({ server, folder }) => ({
            ...sources.find((source) => source.server.id === server.id)!,
            folderId: folder.id!,
          }))
        : sources.map((source) => ({ ...source, folderId: undefined })),
    [type, group, sources],
  );
  const queries = useQueries({
    queries: requests.map(({ server, adapter, folderId }) => {
      if (type === 'resume' || type === 'nextup') {
        const sourceIndex = sources.findIndex((source) => source.server.id === server.id);
        return {
          ...(type === 'resume' ? homeResumeQueryOptions : homeNextUpQueryOptions)({
            adapter,
            currentServer: server,
            libraryIds: visibleHomeLibraryIds(
              libraries.content[sourceIndex].data,
              hidden[server.id],
            ),
            queryClient,
            limit: 40,
          }),
          retry: 1,
        };
      }
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
    combine: combineQueries,
  });
  const refetch = useCallback(
    () =>
      Promise.allSettled(
        [...queries.controls, ...libraries.controls].map((query) => query.refetch()),
      ),
    [queries.controls, libraries.controls],
  );
  useRefetchOnScreenFocus({
    isEnabled: requests.length > 0,
    isStale: queries.controls.some((query) => query.isStale),
    fetchStatus: queries.controls.some((query) => query.isFetching) ? 'fetching' : 'idle',
    refetch,
  });
  const { items, sourceByItem } = useMemo(() => {
    const sourceByItem = new Map<MediaItem, MediaItemSource>();
    requests.forEach((source, index) => {
      queries.content[index].data.forEach((item) => sourceByItem.set(item, source));
    });
    const entries = mergeAggregateHomeItems(
      requests.map(({ server }, index) => ({ server, items: queries.content[index].data })),
      type === 'latest' ? 'latest' : 'resume',
      Infinity,
    );
    return { items: entries.map((entry) => entry.item), sourceByItem };
  }, [requests, queries.content, type]);
  const getItemSource = useCallback((item: MediaItem) => sourceByItem.get(item), [sourceByItem]);

  return {
    items,
    title: group?.title,
    getItemSource,
    refetch,
    isLoading:
      (requests.length === 0 && libraries.content.some((query) => query.isLoading)) ||
      (libraries.content.length > 0 && libraries.content.every((query) => query.isLoading)) ||
      (queries.content.length > 0 && queries.content.every((query) => query.isLoading)),
    isError:
      (queries.content.length > 0 && queries.content.every((query) => query.isError)) ||
      (libraries.content.length > 0 && libraries.content.every((query) => query.isError)),
  };
}
