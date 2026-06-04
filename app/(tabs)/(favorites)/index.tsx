import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useInfiniteQueryWithFocus } from '@/hooks/useInfiniteQueryWithFocus';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { favoritesQueryOptions } from '@/services/media/queryOptions';

export default function FavoritesScreen() {
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const { filters, setFilters } = useMediaFilters();

  const query = useInfiniteQueryWithFocus({
    ...favoritesQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      filters,
    }),
    refetchOnScreenFocus: 'stale',
  });

  return (
    <ItemGridScreen
      title="我的收藏"
      query={query}
      type="series"
      filters={filters}
      onChangeFilters={setFilters}
    />
  );
}
