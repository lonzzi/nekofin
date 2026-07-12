import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { NATIVE_HEADER_ACTIONS } from '@/components/navigation/nativeHeaderModel';
import { getNativeToolbarIcon } from '@/components/navigation/nativeToolbarIcons';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useInfiniteQueryWithFocus } from '@/hooks/useInfiniteQueryWithFocus';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { favoritesQueryOptions } from '@/services/media/queryOptions';
import { Stack } from 'expo-router';

export default function FavoritesScreen() {
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const router = useTracedRouter('favorites');
  const theme = useAppTheme();

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
    <>
      <Stack.Toolbar placement="right">
        {NATIVE_HEADER_ACTIONS.favorites.map((action) => (
          <Stack.Toolbar.Button
            key={action.key}
            accessibilityLabel={action.label}
            icon={getNativeToolbarIcon(action.androidDrawable, action.iosIcon)}
            onPress={() => router.push(action.route)}
            tintColor={theme.colors.text}
          >
            {action.label}
          </Stack.Toolbar.Button>
        ))}
      </Stack.Toolbar>
      <ItemGridScreen
        title="我的收藏"
        query={query}
        type="series"
        filters={filters}
        onChangeFilters={setFilters}
      />
    </>
  );
}
