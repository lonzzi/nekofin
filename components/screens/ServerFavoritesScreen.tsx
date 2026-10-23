import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useInfiniteQueryWithFocus } from '@/hooks/useInfiniteQueryWithFocus';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useTranslation } from '@/lib/i18n';
import { favoritesQueryOptions } from '@/services/media/queryOptions';

export default function FavoritesScreen() {
  const { t: tr } = useTranslation();
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
      title={tr('media.myFavorites')}
      query={query}
      type="series"
      layout="grid"
      filters={filters}
      onChangeFilters={setFilters}
      emptyState={{ title: tr('media.noFavorites'), icon: 'favorites' }}
    />
  );
}
