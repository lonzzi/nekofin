import { ItemGridScreen } from '@/components/media/ItemGridScreen';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useInfiniteQueryWithFocus } from '@/hooks/useInfiniteQueryWithFocus';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useMediaFilters } from '@/hooks/useMediaFilters';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { favoritesQueryOptions } from '@/services/media/queryOptions';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function FavoritesScreen() {
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();
  const navigation = useNavigation();
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="媒体库"
            hitSlop={10}
            onPress={() => router.push('/(tabs)/(servers)/library')}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="film-outline" size={18} color={theme.colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="服务器内搜索"
            hitSlop={10}
            onPress={() => router.push('/(tabs)/(servers)/server-search')}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.colors.surface },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="search" size={18} color={theme.colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, router, theme.colors.surface, theme.colors.text]);

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

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
  },
});
