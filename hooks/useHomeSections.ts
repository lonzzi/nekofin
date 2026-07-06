import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { getHiddenUserViews } from '@/lib/utils/userViewConfig';
import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

export type HomeSection = {
  key: string;
  title: string;
  items: MediaItem[];
  type?: 'latest' | 'nextup' | 'resume' | 'userview';
};

export type HomeSectionWithStatus = HomeSection & { isLoading: boolean };

const HOME_LATEST_SECTION_LIMIT = 4;

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function useHomeSections(currentServer: MediaServerInfo | null) {
  const mediaAdapter = useMediaAdapter();

  const [hiddenUserViewIds, setHiddenUserViewIds] = useState<string[]>(() =>
    currentServer?.id ? getHiddenUserViews(currentServer.id) : [],
  );

  useFocusEffect(
    useCallback(() => {
      if (currentServer?.id) {
        const nextHiddenUserViewIds = getHiddenUserViews(currentServer.id);
        setHiddenUserViewIds((currentHiddenUserViewIds) =>
          areStringArraysEqual(currentHiddenUserViewIds, nextHiddenUserViewIds)
            ? currentHiddenUserViewIds
            : nextHiddenUserViewIds,
        );
      }
    }, [currentServer?.id]),
  );

  const resumeQuery = useQueryWithFocus({
    ...homeResumeQueryOptions({ adapter: mediaAdapter, currentServer }),
    refetchOnScreenFocus: 'stale',
  });

  const nextUpQuery = useQueryWithFocus({
    ...homeNextUpQueryOptions({ adapter: mediaAdapter, currentServer }),
    refetchOnScreenFocus: 'stale',
  });

  const allUserViewQuery = useQueryWithFocus({
    ...homeUserViewsQueryOptions({ adapter: mediaAdapter, currentServer }),
    refetchOnScreenFocus: 'stale',
  });

  const userViewQuery = useMemo(() => {
    if (!allUserViewQuery.data) return { ...allUserViewQuery, data: [] };
    return {
      ...allUserViewQuery,
      data: allUserViewQuery.data.filter((item) => item.id && !hiddenUserViewIds.includes(item.id)),
    };
  }, [allUserViewQuery, hiddenUserViewIds]);

  const latestFolders = useMemo(() => {
    if (!userViewQuery.data) return [];

    return userViewQuery.data
      .filter((item): item is MediaItem & { id: string } => !!item.id)
      .filter((item) => !hiddenUserViewIds.includes(item.id))
      .map((item) => ({
        folderId: item.id!,
        name: item.name || '',
      }));
  }, [userViewQuery.data, hiddenUserViewIds]);

  const visibleLatestFolders = useMemo(
    () => latestFolders.slice(0, HOME_LATEST_SECTION_LIMIT),
    [latestFolders],
  );

  const latestQueries = useQueries({
    queries: visibleLatestFolders.map((folder) =>
      homeLatestByFolderQueryOptions({
        adapter: mediaAdapter,
        currentServer,
        folderId: folder.folderId,
      }),
    ),
  });

  const randomItemsQuery = useQueryWithFocus({
    ...homeRandomQueryOptions({ adapter: mediaAdapter, currentServer }),
    refetchOnScreenFocus: false,
  });

  const resumeSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'resume',
      title: '继续观看',
      items: resumeQuery.data ?? [],
      type: 'resume',
      isLoading: resumeQuery.isPending,
    }),
    [resumeQuery.data, resumeQuery.isPending],
  );

  const nextUpSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'nextup',
      title: '接下来',
      items: nextUpQuery.data ?? [],
      type: 'nextup',
      isLoading: nextUpQuery.isPending,
    }),
    [nextUpQuery.data, nextUpQuery.isPending],
  );

  const userViewSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'userview',
      title: '媒体库',
      items: userViewQuery.data ?? [],
      type: 'userview',
      isLoading: userViewQuery.isPending,
    }),
    [userViewQuery.data, userViewQuery.isPending],
  );

  const latestSections = useMemo<HomeSectionWithStatus[]>(
    () =>
      visibleLatestFolders.map((folder, index) => {
        const query = latestQueries[index];
        const items = query?.data ?? [];

        return {
          key: `latest_${folder.folderId}`,
          title: `最近添加的 ${folder.name}`,
          items,
          type: 'latest',
          isLoading: query?.isPending ?? false,
        } satisfies HomeSectionWithStatus;
      }),
    [visibleLatestFolders, latestQueries],
  );

  const sections = useMemo<HomeSectionWithStatus[]>(
    () => [resumeSection, nextUpSection, userViewSection, ...latestSections],
    [resumeSection, nextUpSection, userViewSection, latestSections],
  );

  return {
    sections,
    resume: resumeSection,
    nextUp: nextUpSection,
    userView: userViewSection,
    latest: latestSections,
    randomItemsQuery,
  };
}
