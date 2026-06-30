import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
} from '@/components/media/cardHelpers';
import PageScrollView from '@/components/PageScrollView';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/design-system';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { queryOptions } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import React, { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInputChangeEvent,
  View,
} from 'react-native';
import { SearchBarCommands } from 'react-native-screens';

type AggregateSearchResult = {
  key: string;
  item: MediaItem;
  server: MediaServerInfo;
  imageUrl?: string;
  blurhash?: string;
};

function aggregateSearchQueryOptions({
  servers,
  keyword,
}: {
  servers: MediaServerInfo[];
  keyword: string;
}) {
  const trimmedKeyword = keyword.trim();

  return queryOptions({
    enabled: servers.length > 0 && trimmedKeyword.length > 0,
    queryKey: mediaQueryKeys.aggregateSearchItems(
      servers.map((server) => server.id),
      trimmedKeyword,
    ),
    queryFn: async (): Promise<AggregateSearchResult[]> => {
      if (trimmedKeyword.length === 0) return [];

      const settled = await Promise.allSettled(
        servers.map(async (server) => {
          const api = createMediaApiFromServerInfo(server);
          const adapter = createMediaAdapterWithApi(server.type, api);
          const items = await adapter.searchItems({
            userId: server.userId,
            searchTerm: trimmedKeyword,
            limit: 60,
          });

          return items.map((item) => {
            const imageInfo = adapter.getImageInfo({
              item,
              opts: getImagePreferenceOptions(
                item.type === 'Episode' || item.type === 'Movie'
                  ? ImageType.Thumb
                  : ImageType.Primary,
              ),
            });

            return {
              key: `${server.id}:${item.id}`,
              item,
              server,
              imageUrl: imageInfo.url,
              blurhash: imageInfo.blurhash,
            };
          });
        }),
      );

      return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    },
    staleTime: 60 * 1000,
  });
}

export default function AggregateSearchScreen() {
  const { servers, setCurrentServer } = useMediaServers();
  const [keyword, setKeyword] = useState('');
  const theme = useAppTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const searchBarRef = useRef<SearchBarCommands>(null);

  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const effectiveKeyword = useMemo(() => debouncedKeyword.trim(), [debouncedKeyword]);

  const {
    data: results = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQueryWithFocus(
    aggregateSearchQueryOptions({
      servers,
      keyword: effectiveKeyword,
    }),
  );

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        ref: searchBarRef as RefObject<SearchBarCommands>,
        placeholder: '搜索所有服务器',
        onChangeText: (event: TextInputChangeEvent) => {
          setKeyword(event.nativeEvent.text);
        },
        onCancelButtonPress: () => setKeyword(''),
        hideWhenScrolling: false,
        cancelButtonText: '取消',
      },
    });
  }, [navigation]);

  const handleOpenResult = useCallback(
    (result: AggregateSearchResult) => {
      setCurrentServer(result.server);
      const route =
        result.item.type === 'Series' || result.item.type === 'Season'
          ? getSeriesCardRoute(result.item)
          : getEpisodeCardRoute(result.item);

      if (route) {
        router.push(route);
      }
    },
    [router, setCurrentServer],
  );

  const groupedResults = useMemo(() => {
    const serverIdToGroup = new Map<
      string,
      { server: MediaServerInfo; items: AggregateSearchResult[] }
    >();
    for (const result of results) {
      const group = serverIdToGroup.get(result.server.id);
      if (group) {
        group.items.push(result);
      } else {
        serverIdToGroup.set(result.server.id, { server: result.server, items: [result] });
      }
    }
    return Array.from(serverIdToGroup.values());
  }, [results]);

  const renderCard = useCallback(
    ({ item: result }: { item: AggregateSearchResult }) => {
      const isSeries = result.item.type === 'Series' || result.item.type === 'Season';
      const imgInfo = { url: result.imageUrl, blurhash: result.blurhash };
      if (isSeries) {
        return (
          <SeriesCard
            item={result.item}
            imgInfo={imgInfo}
            onPress={() => handleOpenResult(result)}
          />
        );
      }
      return (
        <EpisodeCard
          item={result.item}
          imgInfo={imgInfo}
          onPress={() => handleOpenResult(result)}
        />
      );
    },
    [handleOpenResult],
  );

  const cardSeparator = useCallback(
    () => <View style={{ width: theme.spacing.lg }} />,
    [theme.spacing.lg],
  );

  if (effectiveKeyword.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="search" size={34} color={theme.colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>搜索所有服务器</Text>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          已连接 {servers.length} 个服务器，输入关键词后会聚合 Jellyfin 和 Emby 结果。
        </Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        {isLoading ? (
          <ActivityIndicator color={theme.colors.tint} />
        ) : (
          <>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>没有找到内容</Text>
            {isError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => refetch()}
                style={({ pressed }) => [
                  styles.retryButton,
                  { borderColor: theme.colors.separator },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.retryText, { color: theme.colors.tint }]}>重试</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <PageScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.listContent}
    >
      <View style={styles.listHeader}>
        <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
          {isFetching ? '搜索中' : `${results.length} 个结果`}
        </Text>
      </View>
      {groupedResults.map((group) => (
        <View key={group.server.id} style={styles.serverGroup}>
          <View style={styles.groupTitleRow}>
            <Text numberOfLines={1} style={[styles.groupTitle, { color: theme.colors.text }]}>
              {group.server.name}
            </Text>
            <View style={[styles.serverPill, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.serverPillText, { color: theme.colors.textSecondary }]}>
                {group.server.type.toUpperCase()} · {group.items.length}
              </Text>
            </View>
          </View>
          <FlatList
            data={group.items}
            renderItem={renderCard}
            keyExtractor={(item) => item.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
            ItemSeparatorComponent={cardSeparator}
          />
        </View>
      ))}
    </PageScrollView>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = React.useState<string>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 36,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 36,
  },
  listHeader: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 18,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  serverGroup: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  groupTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  cardRow: {
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  serverPill: {
    maxWidth: 140,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  serverPillText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  retryButton: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.68,
  },
});
