import { ItemImage } from '@/components/ItemImage';
import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
} from '@/components/media/cardHelpers';
import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { OuterScreenOptions } from '@/components/outer/OuterPrimitives';
import { emptyListContentStyle, EmptyListViewport } from '@/components/ui/EmptyListViewport';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterChoice, FilterRow } from '@/components/ui/FilterControls';
import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { withOuterTheme } from '@/lib/theme/OuterTheme';
import { createMediaAdapterWithApi, createMediaApiFromServerInfo } from '@/services/media';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import type { MediaItem, MediaServerInfo } from '@/services/media/types';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { queryOptions } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
    queryKey: [
      ...mediaQueryKeys.aggregateSearchItems(
        servers.map((server) => server.id),
        trimmedKeyword,
      ),
      'outer-list-v2',
    ],
    queryFn: async (): Promise<{ items: AggregateSearchResult[]; failedServers: string[] }> => {
      if (trimmedKeyword.length === 0) return { items: [], failedServers: [] };

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
              opts: getImagePreferenceOptions(ImageType.Primary),
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

      return {
        items: settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
        failedServers: settled.flatMap((result, index) =>
          result.status === 'rejected' ? [servers[index].name] : [],
        ),
      };
    },
    staleTime: 60 * 1000,
  });
}

function AggregateSearchScreen() {
  const tabBarInset = useFloatingTabBarInset();
  const { activeServers: servers, setCurrentServer } = useMediaServers();
  const t = useAppTheme();
  const router = useTracedRouter('aggregate-search');
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);
  const query = useQueryWithFocus(aggregateSearchQueryOptions({ servers, keyword: debounced }));
  const results = useMemo(
    () =>
      query.data?.items.filter((result) => filter === 'all' || result.item.type === filter) ?? [],
    [query.data, filter],
  );
  const open = (result: AggregateSearchResult) => {
    const route =
      result.item.type === 'Series' || result.item.type === 'Season'
        ? getSeriesCardRoute(result.item)
        : getEpisodeCardRoute(result.item);
    if (route) {
      setCurrentServer(result.server);
      router.push(route);
    }
  };
  const pending = keyword.trim() !== debounced || query.isLoading;
  const hasKeyword = !!keyword.trim();
  const isEmpty = !hasKeyword || pending || results.length === 0;
  return (
    <>
      <OuterScreenOptions title="搜索" />
      <Stack.SearchBar
        placeholder="搜索所有服务器"
        hideWhenScrolling={false}
        cancelButtonText="取消"
        textColor={t.colors.text}
        hintTextColor={t.colors.textSecondary}
        headerIconColor={t.colors.text}
        onChangeText={(e) => setKeyword(e.nativeEvent.text)}
        onCancelButtonPress={() => setKeyword('')}
      />
      <FlatList
        data={hasKeyword && !pending ? results : []}
        keyExtractor={(item) => item.key}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: t.colors.background }}
        contentContainerStyle={[
          styles.list,
          isEmpty && styles.emptyList,
          isEmpty && emptyListContentStyle,
          tabBarInset > 0 && { paddingBottom: tabBarInset },
        ]}
        ListHeaderComponentStyle={isEmpty ? styles.emptyHeader : undefined}
        ListHeaderComponent={
          <View style={isEmpty ? styles.emptyHeader : undefined}>
            <View style={styles.filters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <FilterRow>
                  {[
                    { label: '全部', value: 'all' },
                    { label: '电影', value: 'Movie' },
                    { label: '剧集', value: 'Series' },
                    { label: '单集', value: 'Episode' },
                  ].map((item) => (
                    <FilterChoice
                      key={item.value}
                      label={item.label}
                      active={filter === item.value}
                      onPress={() => setFilter(item.value)}
                    />
                  ))}
                </FilterRow>
              </ScrollView>
              {hasKeyword && query.data?.failedServers.length ? (
                <View style={[styles.failure, { borderColor: t.colors.separator }]}>
                  <Text style={{ color: t.colors.textSecondary, flex: 1, lineHeight: 21 }}>
                    {query.data.failedServers.join('、')} 未能完成搜索
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void query.refetch()}
                    style={styles.retry}
                  >
                    <Text style={{ color: t.colors.tint }}>重试</Text>
                  </Pressable>
                </View>
              ) : null}
              {hasKeyword && !pending ? (
                <Text style={[styles.count, { color: t.colors.textSecondary }]}>
                  {results.length} 个结果 · {servers.length} 个账号
                </Text>
              ) : null}
            </View>
            {isEmpty ? (
              <EmptyListViewport bottomSpacing={22}>
                {pending && hasKeyword ? (
                  <ActivityIndicator color={t.colors.tint} />
                ) : (
                  <EmptyState
                    icon={servers.length ? 'search' : 'server'}
                    title={
                      !servers.length
                        ? '尚未添加服务器'
                        : hasKeyword
                          ? '没有找到结果'
                          : '输入片名开始搜索'
                    }
                    description={
                      !servers.length
                        ? '请先在服务器页面添加账号。'
                        : hasKeyword
                          ? '请尝试其他片名或更短的关键词。'
                          : undefined
                    }
                  />
                )}
              </EmptyListViewport>
            ) : null}
          </View>
        }
        renderItem={({ item: result }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${result.item.name}，来自 ${result.server.name}`}
            onPress={() => open(result)}
            style={({ pressed }) => [
              styles.result,
              { borderColor: t.colors.separator, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <ItemImage
              uri={result.imageUrl}
              placeholderBlurhash={result.blurhash}
              contentFit="cover"
              style={[styles.poster, { backgroundColor: t.colors.surfaceMuted }]}
            />
            <View style={styles.resultText}>
              <Text numberOfLines={2} style={[styles.name, { color: t.colors.text }]}>
                {result.item.name}
              </Text>
              <Text style={{ color: t.colors.textSecondary, fontSize: 13 }}>
                {[
                  result.item.productionYear,
                  result.item.type === 'Movie'
                    ? '电影'
                    : result.item.type === 'Series'
                      ? '剧集'
                      : result.item.type === 'Episode'
                        ? '单集'
                        : result.item.type,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text numberOfLines={1} style={{ color: t.colors.tint, fontSize: 12 }}>
                {result.server.name} · {result.server.type}
              </Text>
            </View>
            <Text style={{ color: t.colors.textTertiary, fontSize: 22 }}>›</Text>
          </Pressable>
        )}
      />
    </>
  );
}
export default withOuterTheme(AggregateSearchScreen);
const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  count: { fontSize: 12, paddingBottom: 8 },
  emptyList: { paddingBottom: 22 },
  emptyHeader: { flex: 1 },
  filters: { gap: 12 },
  result: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  poster: { width: 76, height: 112, borderRadius: 8 },
  resultText: { flex: 1, gap: 10 },
  name: { fontSize: 18, fontWeight: '600', lineHeight: 25 },
  failure: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  retry: { minWidth: 48, minHeight: 48, justifyContent: 'center' },
});
