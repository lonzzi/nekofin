import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useHiddenUserViews } from '@/hooks/useHiddenUserViews';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { visibleHomeLibraryIds } from '@/services/media/homeVisibility';
import {
  homeUserViewsQueryOptions,
  viewAllItemLayoutType,
  viewAllQueryOptions,
} from '@/services/media/queryOptions';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function ServerViewAllScreen() {
  const { type, folderId, folderName } = useLocalSearchParams<{
    type: string;
    folderId?: string;
    folderName?: string;
  }>();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const { filters, setFilters } = useMediaFilters();
  const queryClient = useQueryClient();
  const hidden = useHiddenUserViews(currentServer ? [currentServer.id] : []);
  const libraries = useQueryWithFocus(
    homeUserViewsQueryOptions({ adapter: mediaAdapter, currentServer }),
  );
  const libraryIds = visibleHomeLibraryIds(
    libraries.data,
    currentServer ? hidden[currentServer.id] : [],
  );

  const getTitle = () => {
    switch (type) {
      case 'resume':
        return '继续观看';
      case 'nextup':
        return '接下来';
      case 'latest':
        return folderName ? `最近添加的 ${folderName}` : '最新内容';
      default:
        return '查看所有';
    }
  };

  const query = useInfiniteQuery(
    viewAllQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      type,
      folderId,
      filters,
      libraryIds,
      queryClient,
    }),
  );

  return (
    <ItemGridScreen
      title={getTitle()}
      query={query}
      dataState={{
        isLoading: libraries.isLoading || query.isLoading,
        isError: libraries.isError || query.isError,
        refetch: () => Promise.allSettled([libraries.refetch(), query.refetch()]),
      }}
      type={viewAllItemLayoutType(type)}
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}
