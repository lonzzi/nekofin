import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { viewAllItemLayoutType, viewAllQueryOptions } from '@/services/media/queryOptions';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

export default function ViewAllScreen() {
  const { type, folderId, folderName } = useLocalSearchParams<{
    type: string;
    folderId?: string;
    folderName?: string;
  }>();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const { filters, setFilters } = useMediaFilters();

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
    }),
  );

  return (
    <ItemGridScreen
      title={getTitle()}
      query={query}
      type={viewAllItemLayoutType(type)}
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}
