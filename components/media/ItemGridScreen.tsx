import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { MediaFilters } from '@/hooks/useMediaFilters';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import useRefresh from '@/hooks/useRefresh';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { availableFiltersQueryOptions } from '@/services/media/queryOptions';
import { MediaItem, MediaSortBy } from '@/services/media/types';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { GlassContainer } from 'expo-glass-effect';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PageScrollView from '../PageScrollView';
import { FilterButton } from '../ui/FilterButton';
import { SkeletonItemGrid } from '../ui/Skeleton';
import { dedupeMediaItems, flattenItemGridPages, groupMediaItems } from './itemGridData';

export type ItemGridScreenProps = {
  title: string;
  query?: UseInfiniteQueryResult<
    InfiniteData<MediaItem[] | { items: MediaItem[]; total: number }, unknown>,
    unknown
  >;
  data?: MediaItem[];
  type?: 'series' | 'episode';
  filters?: MediaFilters;
  onChangeFilters?: (next: MediaFilters) => void;
  disableGrouping?: boolean;
};

export function ItemGridScreen({
  title,
  query,
  data: dataProp,
  type,
  filters,
  onChangeFilters,
  disableGrouping = false,
}: ItemGridScreenProps) {
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#000' }, 'background');
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const { accentColor } = useAccentColor();
  const { numColumns, itemWidth, gap } = useGridLayout(type);
  const episodeLayout = useGridLayout('episode');

  const navigation = useNavigation();
  const { currentServer } = useMediaServers();
  const mediaAdapter = useMediaAdapter();

  const queryData = query ? query.data : undefined;
  const isLoading = query ? query.isLoading : false;
  const isError = query ? query.isError : false;
  const refetch = query ? query.refetch : undefined;
  const fetchNextPage = query ? query.fetchNextPage : undefined;
  const hasNextPage = query ? query.hasNextPage : false;
  const isFetchingNextPage = query ? query.isFetchingNextPage : false;

  const useThreeCols = type === 'series';

  const items = useMemo(() => {
    if (dataProp) {
      return dedupeMediaItems(dataProp);
    }
    if (queryData) {
      return flattenItemGridPages(queryData.pages);
    }
    return [];
  }, [dataProp, queryData]);

  const groupedItems = useMemo(() => {
    return groupMediaItems(items, disableGrouping);
  }, [items, disableGrouping]);

  const { refreshing, onRefresh } = useRefresh(refetch || (async () => {}));

  const { data: availableFilters } = useQueryWithFocus(
    availableFiltersQueryOptions({
      adapter: mediaAdapter,
      currentServer,
      enabled: !!onChangeFilters,
    }),
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const itemStyle = { width: itemWidth };

      if (item.type === 'Episode') {
        return <EpisodeCard item={item} style={itemStyle} />;
      }

      return useThreeCols ? (
        <SeriesCard item={item} style={itemStyle} />
      ) : (
        <EpisodeCard item={item} style={itemStyle} />
      );
    },
    [itemWidth, useThreeCols],
  );

  const keyExtractor = useCallback(
    (item: MediaItem, index: number) => item.id || `item-${index}`,
    [],
  );

  const handleEndReached = useCallback(async () => {
    if (!query || !hasNextPage || isFetchingNextPage || !fetchNextPage) return;
    await fetchNextPage();
  }, [query, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const listFooter = useMemo(() => {
    if (!query) return <View style={{ height: 16 }} />;
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerLoadingContainer}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      );
    }
    if (!hasNextPage) return <View style={{ height: 16 }} />;
    return <View style={{ height: 16 }} />;
  }, [query, isFetchingNextPage, hasNextPage, accentColor]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const renderFilterBar = useCallback(() => {
    if (!onChangeFilters) return null;

    return (
      <View style={styles.filterBar}>
        <ScrollView
          style={{
            marginHorizontal: -20,
            paddingVertical: 40,
            position: 'absolute',
            top: -50,
            width: '200%',
          }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <GlassContainer spacing={10} style={[styles.filterRow]}>
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
              onSelect={(v) => {
                onChangeFilters?.({
                  includeItemTypes: filters?.includeItemTypes,
                  sortBy: filters?.sortBy,
                  sortOrder: filters?.sortOrder,
                  year: v ? Number(v) : undefined,
                  tags: filters?.tags,
                  onlyUnplayed: filters?.onlyUnplayed,
                });
              }}
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
              onSelect={(v) => {
                if (!v) {
                  onChangeFilters?.({
                    includeItemTypes: filters?.includeItemTypes,
                    sortBy: filters?.sortBy,
                    sortOrder: filters?.sortOrder,
                    year: filters?.year,
                    tags: undefined,
                    onlyUnplayed: filters?.onlyUnplayed,
                  });
                } else {
                  const nextTags = [v];
                  onChangeFilters?.({
                    includeItemTypes: filters?.includeItemTypes,
                    sortBy: filters?.sortBy,
                    sortOrder: filters?.sortOrder,
                    year: filters?.year,
                    tags: nextTags,
                    onlyUnplayed: filters?.onlyUnplayed,
                  });
                }
              }}
            />
            <FilterButton
              label="排序依据"
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
              onSelect={(v) => {
                onChangeFilters?.({
                  includeItemTypes: filters?.includeItemTypes,
                  sortBy: v ? [v as MediaSortBy] : filters?.sortBy,
                  sortOrder: filters?.sortOrder,
                  year: filters?.year,
                  tags: filters?.tags,
                  onlyUnplayed: filters?.onlyUnplayed,
                });
              }}
            />
            <FilterButton
              label="排序顺序"
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
              onSelect={(v) => {
                onChangeFilters?.({
                  includeItemTypes: filters?.includeItemTypes,
                  sortBy: filters?.sortBy,
                  sortOrder: (v as 'Ascending' | 'Descending') ?? filters?.sortOrder,
                  year: filters?.year,
                  tags: filters?.tags,
                  onlyUnplayed: filters?.onlyUnplayed,
                });
              }}
            />
          </GlassContainer>
        </ScrollView>
      </View>
    );
  }, [onChangeFilters, availableFilters, filters]);

  const renderGroupSection = useCallback(
    (group: { key: string; title: string; items: MediaItem[] }, showTitle: boolean) => {
      const isEpisodeGroup = group.key === 'Episode';
      const groupItemWidth = isEpisodeGroup ? episodeLayout.itemWidth : itemWidth;

      return (
        <View key={group.key} style={styles.groupSection}>
          {showTitle && (
            <Text style={[styles.sectionTitle, { color: textColor }]}>{group.title}</Text>
          )}
          <FlatList
            data={group.items}
            renderItem={({ item }) => {
              const itemStyle = { width: groupItemWidth };
              if (item.type === 'Episode') {
                return <EpisodeCard item={item} style={itemStyle} />;
              }
              return useThreeCols ? (
                <SeriesCard item={item} style={itemStyle} />
              ) : (
                <EpisodeCard item={item} style={itemStyle} />
              );
            }}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalList}
            contentContainerStyle={styles.horizontalListContainer}
            contentInsetAdjustmentBehavior="never"
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
          />
        </View>
      );
    },
    [episodeLayout.itemWidth, itemWidth, textColor, keyExtractor, handleEndReached, useThreeCols],
  );

  if (query && isLoading) {
    return (
      <PageScrollView style={[styles.container, { backgroundColor }]}>
        <SkeletonItemGrid type={type} numColumns={numColumns} itemWidth={itemWidth} gap={gap} />
      </PageScrollView>
    );
  }

  if (query && isError) {
    return (
      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>加载失败，请重试</Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={() => {
              refetch?.();
            }}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (groupedItems.length === 1) {
    return (
      <FlatList
        data={groupedItems[0].items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        key={`${groupedItems[0].key}-${numColumns}-cols`}
        columnWrapperStyle={numColumns > 1 ? { columnGap: gap } : undefined}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: Platform.OS === 'android' ? 100 : 0 },
        ]}
        ListHeaderComponent={renderFilterBar()}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: textColor }]}>暂无内容</Text>
          </View>
        }
        style={{ backgroundColor }}
      />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor }}
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderFilterBar()}

      {groupedItems.length > 0 ? (
        groupedItems.map((group) => renderGroupSection(group, true))
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: textColor }]}>暂无内容</Text>
        </View>
      )}

      {listFooter}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  filterBar: {
    position: 'relative',
    paddingBottom: 8,
    height: 24,
  },
  filterRow: {
    flexDirection: 'row',
    columnGap: 8,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    rowGap: 16,
  },
  groupSection: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  groupListContainer: {
    rowGap: 16,
  },
  horizontalListContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    paddingVertical: 12,
  },
  horizontalList: {
    marginHorizontal: -20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  footerLoadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
