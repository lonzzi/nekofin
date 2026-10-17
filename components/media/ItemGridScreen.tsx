import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { MediaFilters } from '@/hooks/useMediaFilters';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import useRefresh from '@/hooks/useRefresh';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAppTheme } from '@/lib/theme';
import { availableFiltersQueryOptions } from '@/services/media/queryOptions';
import { MediaItem, MediaItemType, MediaSortBy } from '@/services/media/types';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PageScrollView from '../PageScrollView';
import { emptyListContentStyle, EmptyListViewport } from '../ui/EmptyListViewport';
import { EmptyState, type EmptyStateProps } from '../ui/EmptyState';
import { FilterButton, FilterRow } from '../ui/FilterControls';
import { SafeAreaRefreshControl } from '../ui/SafeAreaRefreshControl';
import { SkeletonItemGrid } from '../ui/Skeleton';
import {
  createItemGridSections,
  dedupeMediaItems,
  flattenItemGridPages,
  groupMediaItems,
} from './itemGridData';
import { getSourcedMediaKey, type GetMediaItemSource } from './mediaSource';

export type ItemGridScreenProps = {
  title: string;
  query?: UseInfiniteQueryResult<
    InfiniteData<MediaItem[] | { items: MediaItem[]; total: number }, unknown>,
    unknown
  >;
  data?: MediaItem[];
  type?: 'series' | 'episode';
  layout?: 'auto' | 'grid';
  filters?: MediaFilters;
  onChangeFilters?: (next: MediaFilters) => void;
  disableGrouping?: boolean;
  getItemSource?: GetMediaItemSource;
  showServerSource?: boolean;
  dataState?: { isLoading: boolean; isError: boolean; refetch: () => Promise<unknown> };
  emptyState?: EmptyStateProps;
};

export function ItemGridScreen({
  title,
  query,
  data: dataProp,
  type,
  layout = 'auto',
  filters,
  onChangeFilters,
  disableGrouping = false,
  getItemSource,
  showServerSource = true,
  dataState,
  emptyState = { title: '暂无内容' },
}: ItemGridScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarInset();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const { numColumns, itemWidth, gap } = useGridLayout(type, layout === 'grid' ? 160 : undefined);
  const episodeLayout = useGridLayout('episode');

  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const queryData = query ? query.data : undefined;
  const isLoading = dataState?.isLoading ?? query?.isLoading ?? false;
  const isError = dataState?.isError ?? query?.isError ?? false;
  const refetch = dataState?.refetch ?? query?.refetch;
  const fetchNextPage = query ? query.fetchNextPage : undefined;
  const hasNextPage = query ? query.hasNextPage : false;
  const isFetchingNextPage = query ? query.isFetchingNextPage : false;

  const useThreeCols = type === 'series';

  const items = useMemo(() => {
    if (dataProp) {
      return dedupeMediaItems(
        dataProp,
        getItemSource ? (item) => getSourcedMediaKey(item, getItemSource(item)) : undefined,
      );
    }
    if (queryData) {
      return flattenItemGridPages(queryData.pages);
    }
    return [];
  }, [dataProp, queryData, getItemSource]);

  const groupedItems = useMemo(() => {
    return groupMediaItems(items, disableGrouping);
  }, [items, disableGrouping]);

  const gridSections = useMemo(
    () => createItemGridSections(groupedItems, numColumns, episodeLayout.numColumns),
    [groupedItems, numColumns, episodeLayout.numColumns],
  );

  const { refreshing, onRefresh } = useRefresh(refetch || (async () => {}));

  const { data: availableFilters } = useQueryWithFocus(
    availableFiltersQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      enabled: !!onChangeFilters,
    }),
  );

  const renderMediaCard = useCallback(
    (item: MediaItem, width: number) => {
      const itemStyle = { width };
      if (item.type !== 'Episode' && useThreeCols) {
        return (
          <SeriesCard
            item={item}
            source={getItemSource?.(item)}
            showServerSource={showServerSource}
            style={itemStyle}
          />
        );
      }
      return (
        <EpisodeCard
          item={item}
          source={getItemSource?.(item)}
          showServerSource={showServerSource}
          style={itemStyle}
        />
      );
    },
    [useThreeCols, getItemSource, showServerSource],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => renderMediaCard(item, itemWidth),
    [renderMediaCard, itemWidth],
  );

  const keyExtractor = useCallback(
    (item: MediaItem, index: number) =>
      item.id ? getSourcedMediaKey(item, getItemSource?.(item)) : `item-${index}`,
    [getItemSource],
  );

  const handleEndReached = useCallback(async () => {
    if (!query || !hasNextPage || isFetchingNextPage || !fetchNextPage) return;
    await fetchNextPage();
  }, [query, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const listFooter = useMemo(() => {
    if (query && isFetchingNextPage) {
      return (
        <View style={styles.footerLoadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.tint} />
        </View>
      );
    }
    return <View style={{ height: 16 }} />;
  }, [query, isFetchingNextPage, theme.colors.tint]);

  const patchFilters = useCallback(
    (patch: Partial<MediaFilters>) => onChangeFilters?.({ ...filters, ...patch }),
    [onChangeFilters, filters],
  );

  const selectedItemType =
    filters?.includeItemTypes?.length === 1 ? filters.includeItemTypes[0] : undefined;

  const renderFilterBar = useCallback(() => {
    if (!onChangeFilters) return null;

    return (
      <View style={[styles.filterBar, { marginHorizontal: -theme.spacing.page }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[
            styles.filterScrollContent,
            { paddingHorizontal: theme.spacing.page },
          ]}
          contentInsetAdjustmentBehavior="never"
        >
          <FilterRow spacing={theme.spacing.sm}>
            <FilterButton
              label="类型"
              title="选择类型"
              options={[
                { label: '全部', value: '', active: !selectedItemType },
                {
                  label: '电影',
                  value: 'Movie',
                  active: selectedItemType === 'Movie',
                },
                {
                  label: '剧集',
                  value: 'Series',
                  active: selectedItemType === 'Series',
                },
                {
                  label: '单集',
                  value: 'Episode',
                  active: selectedItemType === 'Episode',
                },
                {
                  label: '文件夹',
                  value: 'Folder',
                  active: selectedItemType === 'Folder',
                },
                {
                  label: '合集',
                  value: 'BoxSet',
                  active: selectedItemType === 'BoxSet',
                },
                {
                  label: '播放列表',
                  value: 'Playlist',
                  active: selectedItemType === 'Playlist',
                },
              ]}
              onSelect={(v) =>
                patchFilters({ includeItemTypes: v ? [v as MediaItemType] : undefined })
              }
            />
            <FilterButton
              label="年份"
              title="选择年份"
              options={[
                { label: '不限' },
                ...(availableFilters?.years ?? []).map((y) => ({
                  label: String(y),
                  value: String(y),
                  active: filters?.year === y,
                })),
              ]}
              onSelect={(v) => patchFilters({ year: v ? Number(v) : undefined })}
            />
            <FilterButton
              label="标签"
              title="选择标签"
              options={[
                { label: '不限' },
                ...(availableFilters?.tags ?? []).map((t) => ({
                  label: t,
                  value: t,
                  active: !!filters?.tags?.includes(t),
                })),
              ]}
              onSelect={(v) => patchFilters({ tags: v ? [v] : undefined })}
            />
            <FilterButton
              label="排序"
              title="选择排序依据"
              options={[
                {
                  label: '名称',
                  value: 'SortName',
                  active: (filters?.sortBy?.[0] ?? 'SortName') === 'SortName',
                },
                {
                  label: '随机',
                  value: 'Random',
                  active: (filters?.sortBy?.[0] ?? '') === 'Random',
                },
                {
                  label: '公众评分',
                  value: 'CommunityRating',
                  active: (filters?.sortBy?.[0] ?? '') === 'CommunityRating',
                },
                {
                  label: '剧集添加日期',
                  value: 'DateCreated',
                  active: (filters?.sortBy?.[0] ?? '') === 'DateCreated',
                },
                {
                  label: '播放日期',
                  value: 'DatePlayed',
                  active: (filters?.sortBy?.[0] ?? '') === 'DatePlayed',
                },
                {
                  label: '家长分级',
                  value: 'OfficialRating',
                  active: (filters?.sortBy?.[0] ?? '') === 'OfficialRating',
                },
                {
                  label: '发行日期',
                  value: 'PremiereDate',
                  active: (filters?.sortBy?.[0] ?? '') === 'PremiereDate',
                },
              ]}
              onSelect={(v) => patchFilters({ sortBy: v ? [v as MediaSortBy] : filters?.sortBy })}
            />
            <FilterButton
              label="顺序"
              title="选择排序顺序"
              options={[
                {
                  label: '降序',
                  value: 'Descending',
                  active: (filters?.sortOrder ?? 'Descending') === 'Descending',
                },
                {
                  label: '升序',
                  value: 'Ascending',
                  active: (filters?.sortOrder ?? 'Descending') === 'Ascending',
                },
              ]}
              onSelect={(v) =>
                patchFilters({ sortOrder: (v as 'Ascending' | 'Descending') ?? filters?.sortOrder })
              }
            />
          </FilterRow>
        </ScrollView>
      </View>
    );
  }, [
    onChangeFilters,
    availableFilters,
    filters,
    selectedItemType,
    patchFilters,
    theme.spacing.page,
    theme.spacing.sm,
  ]);

  const renderGroupSection = useCallback(
    (group: { key: string; title: string; items: MediaItem[] }, showTitle: boolean) => {
      const isEpisodeGroup = group.key === 'Episode';
      const groupItemWidth = isEpisodeGroup ? episodeLayout.itemWidth : itemWidth;

      return (
        <View key={group.key} style={{ paddingTop: theme.spacing.sm }}>
          {showTitle && (
            <Text
              style={[
                theme.typography.bodyEmphasized,
                { color: theme.colors.text, marginBottom: theme.spacing.sm },
              ]}
            >
              {group.title}
            </Text>
          )}
          <FlatList
            data={group.items}
            renderItem={({ item }) => renderMediaCard(item, groupItemWidth)}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -theme.spacing.page }}
            contentContainerStyle={{
              paddingLeft: theme.spacing.page,
              paddingRight: theme.spacing.page,
              paddingVertical: theme.spacing.md,
            }}
            contentInsetAdjustmentBehavior="never"
            ItemSeparatorComponent={() => <View style={{ width: theme.spacing.lg }} />}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
          />
        </View>
      );
    },
    [episodeLayout.itemWidth, itemWidth, theme, keyExtractor, handleEndReached, renderMediaCard],
  );

  if ((query || dataState) && isLoading) {
    return (
      <>
        <Stack.Title large>{title}</Stack.Title>
        <PageScrollView style={[styles.container, { backgroundColor }]}>
          <SkeletonItemGrid type={type} numColumns={numColumns} itemWidth={itemWidth} gap={gap} />
        </PageScrollView>
      </>
    );
  }

  if ((query || dataState) && isError) {
    return (
      <>
        <Stack.Title large>{title}</Stack.Title>
        <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
          <View style={styles.errorContainer}>
            <Text
              style={[
                theme.typography.body,
                styles.errorText,
                { color: theme.colors.text, marginBottom: theme.spacing.xl },
              ]}
            >
              加载失败，请重试
            </Text>
            <Pressable
              style={{
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radius.sm,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
              }}
              onPress={() => {
                refetch?.();
              }}
            >
              <Text style={[theme.typography.bodyEmphasized, { color: theme.colors.inverseText }]}>
                重试
              </Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (layout === 'grid' && items.length > 0) {
    return (
      <>
        <Stack.Title large>{title}</Stack.Title>
        <SectionList
          sections={gridSections}
          keyExtractor={(row) => keyExtractor(row[0], 0)}
          renderItem={({ item: row, section }) => (
            <View style={{ flexDirection: 'row', gap, marginBottom: theme.spacing.lg }}>
              {row.map((item, index) => (
                <View key={keyExtractor(item, index)}>
                  {renderMediaCard(
                    item,
                    section.key === 'Episode' ? episodeLayout.itemWidth : itemWidth,
                  )}
                </View>
              ))}
            </View>
          )}
          renderSectionHeader={({ section }) =>
            groupedItems.length > 1 ? (
              <Text
                style={[
                  theme.typography.bodyEmphasized,
                  {
                    color: theme.colors.text,
                    marginTop: theme.spacing.sm,
                    marginBottom: theme.spacing.md,
                  },
                ]}
              >
                {section.title}
              </Text>
            ) : null
          }
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<SafeAreaRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: theme.spacing.page,
              paddingTop: theme.spacing.sm,
              paddingBottom:
                Platform.OS === 'android' ? tabBarInset || 100 + insets.bottom : theme.spacing.xl,
            },
          ]}
          ListHeaderComponent={renderFilterBar()}
          ListFooterComponent={listFooter}
          style={{ backgroundColor }}
        />
      </>
    );
  }

  if (groupedItems.length === 1) {
    return (
      <>
        <Stack.Title large>{title}</Stack.Title>
        <FlatList
          data={groupedItems[0].items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          key={`${groupedItems[0].key}-${numColumns}-cols`}
          columnWrapperStyle={numColumns > 1 ? { columnGap: gap } : undefined}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<SafeAreaRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Platform.OS === 'android' ? tabBarInset || 100 : 0,
              paddingHorizontal: theme.spacing.page,
              paddingTop: theme.spacing.sm,
              rowGap: theme.spacing.lg,
            },
          ]}
          ListHeaderComponent={renderFilterBar()}
          ListFooterComponent={listFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                暂无内容
              </Text>
            </View>
          }
          style={{ backgroundColor }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Title large>{title}</Stack.Title>
      <ScrollView
        style={{ backgroundColor }}
        contentContainerStyle={[
          styles.scrollContent,
          groupedItems.length === 0 && emptyListContentStyle,
          {
            paddingHorizontal: theme.spacing.page,
            paddingTop: theme.spacing.sm,
            paddingBottom: tabBarInset || theme.spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<SafeAreaRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderFilterBar()}

        {groupedItems.length > 0 ? (
          groupedItems.map((group) => renderGroupSection(group, true))
        ) : (
          <EmptyListViewport bottomSpacing={theme.spacing.xl + 16}>
            <EmptyState {...emptyState} />
          </EmptyListViewport>
        )}

        {listFooter}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  filterBar: {
    paddingBottom: 12,
    overflow: 'visible',
  },
  filterScroll: {
    overflow: 'visible',
  },
  filterScrollContent: {
    paddingVertical: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
