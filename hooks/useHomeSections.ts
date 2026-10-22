import { useHiddenUserViews } from '@/hooks/useHiddenUserViews';
import { useHomeCarouselLibraries } from '@/hooks/useHomeCarouselLibraries';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useTranslation } from '@/lib/i18n';
import { homeCarouselLibraryIds, visibleHomeLibraryIds } from '@/services/media/homeVisibility';
import {
  homeLatestByFolderQueryOptions,
  homeNextUpQueryOptions,
  homeRandomQueryOptions,
  homeResumeQueryOptions,
  homeUserViewsQueryOptions,
} from '@/services/media/queryOptions';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

export type HomeSection = {
  key: string;
  title: string;
  folderName?: string;
  items: MediaItem[];
  type?: 'latest' | 'nextup' | 'resume' | 'userview';
};

export type HomeSectionWithStatus = HomeSection & { isLoading: boolean };

const HOME_LATEST_SECTION_LIMIT = 4;

export function useHomeSections(currentServer: MediaServerInfo | null) {
  const { t: tr } = useTranslation();
  const mediaAdapter = useMediaAdapter();
  const currentServerId = currentServer?.id;
  const queryClient = useQueryClient();

  const hidden = useHiddenUserViews(currentServerId ? [currentServerId] : []);
  const carouselLibraries = useHomeCarouselLibraries(currentServerId ? [currentServerId] : []);
  const hiddenUserViewIds = useMemo(
    () => (currentServerId ? (hidden[currentServerId] ?? []) : []),
    [currentServerId, hidden],
  );

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

  const libraryIds = visibleHomeLibraryIds(allUserViewQuery.data, hiddenUserViewIds);
  const resumeQuery = useQueryWithFocus({
    ...homeResumeQueryOptions({ adapter: mediaAdapter, currentServer, libraryIds, queryClient }),
    refetchOnScreenFocus: 'stale',
  });
  const nextUpQuery = useQueryWithFocus({
    ...homeNextUpQueryOptions({ adapter: mediaAdapter, currentServer, libraryIds, queryClient }),
    refetchOnScreenFocus: 'stale',
  });

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
    ...homeRandomQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      libraryIds: homeCarouselLibraryIds(
        allUserViewQuery.data,
        hiddenUserViewIds,
        currentServerId ? carouselLibraries[currentServerId] : null,
      ),
    }),
    refetchOnScreenFocus: false,
  });

  const resumeSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'resume',
      title: tr('home.continueWatching'),
      items: resumeQuery.data ?? [],
      type: 'resume',
      isLoading: allUserViewQuery.isLoading || resumeQuery.isLoading,
    }),
    [resumeQuery.data, resumeQuery.isLoading, allUserViewQuery.isLoading, tr],
  );

  const nextUpSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'nextup',
      title: tr('home.upNext'),
      items: nextUpQuery.data ?? [],
      type: 'nextup',
      isLoading: allUserViewQuery.isLoading || nextUpQuery.isLoading,
    }),
    [nextUpQuery.data, nextUpQuery.isLoading, allUserViewQuery.isLoading, tr],
  );

  const userViewSection = useMemo<HomeSectionWithStatus>(
    () => ({
      key: 'userview',
      title: tr('media.libraries'),
      items: userViewQuery.data ?? [],
      type: 'userview',
      isLoading: userViewQuery.isPending,
    }),
    [userViewQuery.data, userViewQuery.isPending, tr],
  );

  const latestSections = useMemo<HomeSectionWithStatus[]>(
    () =>
      visibleLatestFolders.map((folder, index) => {
        const query = latestQueries[index];
        const items = query?.data ?? [];

        return {
          key: `latest_${folder.folderId}`,
          title: tr('home.recentlyAddedInNamedLibrary', { name: folder.name }),
          folderName: folder.name,
          items,
          type: 'latest',
          isLoading: query?.isPending ?? false,
        } satisfies HomeSectionWithStatus;
      }),
    [visibleLatestFolders, latestQueries, tr],
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
    isCarouselLoading: allUserViewQuery.isLoading || randomItemsQuery.isLoading,
  };
}
