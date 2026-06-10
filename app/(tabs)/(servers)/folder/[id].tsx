import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { folderItemsQueryOptions, normalizeRouteItemType } from '@/services/media/queryOptions';
import { MediaItemType } from '@/services/media/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function ServerFolderScreen() {
  const { id, name, itemTypes } = useLocalSearchParams<{
    id: string;
    name?: string;
    itemTypes?: MediaItemType;
  }>();

  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const { filters, setFilters } = useMediaFilters({
    includeItemTypes: normalizeRouteItemType(itemTypes),
  });

  const query = useInfiniteQuery(
    folderItemsQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      folderId: id,
      filters,
    }),
  );

  return (
    <ItemGridScreen
      title={name || '全部内容'}
      query={query}
      type="series"
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}
