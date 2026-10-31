import { EpisodeCard, SeriesCard } from '@/components/media/Card';
import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { NativeListTitle } from '@/components/navigation/NativeListTitle';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useGridLayout } from '@/hooks/useGridLayout';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { MediaFilters } from '@/hooks/useMediaFilters';
import { useQueryWithFocus } from '@/hooks/useQueryWithFocus';
import useRefresh from '@/hooks/useRefresh';
import { useScreenTransitionReady } from '@/hooks/useScreenTransitionReady';
import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { t as tr, useTranslation } from '@/lib/i18n';
import { scheduleAfterNavigation } from '@/lib/navigationWork';
import { useAppTheme } from '@/lib/theme';
import { availableFiltersQueryOptions } from '@/services/media/queryOptions';
import { MediaItem, MediaItemType, MediaSortBy } from '@/services/media/types';
import { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getMediaGridListConfig } from './gridPerformanceConfig';
import {
  createItemGridSections,
  dedupeMediaItems,
  flattenItemGridPages,
  groupMediaItems,
} from './itemGridData';
import { getSourcedMediaKey, type GetMediaItemSource } from './mediaSource';
import { getMediaRailListConfig } from './railPerformanceConfig';

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
  emptyState = { title: tr('media.noContent') },
}: ItemGridScreenProps) {
  const { t: tr } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarInset();
  const theme = useAppTheme();
  const backgroundColor = theme.colors.background;
  const { numColumns, itemWidth, gap } = useGridLayout(type, layout === 'grid' ? 160 : undefined);
  const episodeLayout = useGridLayout('episode');
  const viewport = useContentDimensions();
  const transitionReady = useScreenTransitionReady();
  const [renderAheadReady, setRenderAheadReady] = useState(false);

  useEffect(() => {
    if (!transitionReady || renderAheadReady) return;
    const task = scheduleAfterNavigation(() => setRenderAheadReady(true));
    return () => task.cancel();
  }, [transitionReady, renderAheadReady]);

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
  const cardCopyHeight =
    (theme.typography.bodyEmphasized.lineHeight + theme.typography.footnote.lineHeight) *
      viewport.fontScale +
    theme.spacing.lg * 2;
  const posterRowHeight = itemWidth * 1.5 + cardCopyHeight;
  const episodeRowHeight = episodeLayout.itemWidth * (9 / 16) + cardCopyHeight;
  const gridBatching = getMediaGridListConfig({
    viewportHeight: viewport.height,
    numColumns: layout === 'grid' ? Math.max(numColumns, episodeLayout.numColumns) : numColumns,
    renderAheadReady,
    rowHeight:
      layout === 'grid'
        ? Math.min(posterRowHeight, episodeRowHeight)
        : useThreeCols
          ? posterRowHeight
          : itemWidth * (9 / 16) + cardCopyHeight,
  });

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
    return groupMediaItems(items, disableGrouping, tr);
  }, [items, disableGrouping, tr]);

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
      // Ungrouped grids keep one card shape and preserve the server's order,
      // including latest-media responses that mix series with episodes.
      if (useThreeCols && (disableGrouping || item.type !== 'Episode')) {
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
    [useThreeCols, disableGrouping, getItemSource, showServerSource],
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
              label={tr('media.type')}
              title={tr('media.chooseType')}
              options={[
                { label: tr('common.all'), value: '', active: !selectedItemType },
                {
                  label: tr('media.movies'),
                  value: 'Movie',
                  active: selectedItemType === 'Movie',
                },
                {
                  label: tr('media.series'),
                  value: 'Series',
                  active: selectedItemType === 'Series',
                },
                {
                  label: tr('media.episodes'),
                  value: 'Episode',
                  active: selectedItemType === 'Episode',
                },
                {
                  label: tr('media.folders'),
                  value: 'Folder',
                  active: selectedItemType === 'Folder',
                },
                {
                  label: tr('media.collections'),
                  value: 'BoxSet',
                  active: selectedItemType === 'BoxSet',
                },
                {
                  label: tr('media.playlists'),
                  value: 'Playlist',
                  active: selectedItemType === 'Playlist',
                },
              ]}
              onSelect={(v) =>
                patchFilters({ includeItemTypes: v ? [v as MediaItemType] : undefined })
              }
            />
            <FilterButton
              label={tr('media.year')}
              title={tr('media.chooseYear')}
              options={[
                { label: tr('common.any') },
                ...(availableFilters?.years ?? []).map((y) => ({
                  label: String(y),
                  value: String(y),
                  active: filters?.year === y,
                })),
              ]}
              onSelect={(v) => patchFilters({ year: v ? Number(v) : undefined })}
            />
            <FilterButton
              label={tr('media.tags')}
              title={tr('media.chooseTags')}
              options={[
                { label: tr('common.any') },
                ...(availableFilters?.tags ?? []).map((t) => ({
                  label: t,
                  value: t,
                  active: !!filters?.tags?.includes(t),
                })),
              ]}
              onSelect={(v) => patchFilters({ tags: v ? [v] : undefined })}
            />
            <FilterButton
              label={tr('media.sort')}
              title={tr('media.sortBy')}
              options={[
                {
                  label: tr('common.name'),
                  value: 'SortName',
                  active: (filters?.sortBy?.[0] ?? 'SortName') === 'SortName',
                },
                {
                  label: tr('media.sortRandom'),
                  value: 'Random',
                  active: (filters?.sortBy?.[0] ?? '') === 'Random',
                },
                {
                  label: tr('media.communityRating'),
                  value: 'CommunityRating',
                  active: (filters?.sortBy?.[0] ?? '') === 'CommunityRating',
                },
                {
                  label: tr('media.dateAdded'),
                  value: 'DateCreated',
                  active: (filters?.sortBy?.[0] ?? '') === 'DateCreated',
                },
                {
                  label: tr('media.datePlayed'),
                  value: 'DatePlayed',
                  active: (filters?.sortBy?.[0] ?? '') === 'DatePlayed',
                },
                {
                  label: tr('media.parentalRating'),
                  value: 'OfficialRating',
                  active: (filters?.sortBy?.[0] ?? '') === 'OfficialRating',
                },
                {
                  label: tr('media.releaseDate'),
                  value: 'PremiereDate',
                  active: (filters?.sortBy?.[0] ?? '') === 'PremiereDate',
                },
              ]}
              onSelect={(v) => patchFilters({ sortBy: v ? [v as MediaSortBy] : filters?.sortBy })}
            />
            <FilterButton
              label={tr('media.order')}
              title={tr('media.chooseSortOrder')}
              options={[
                {
                  label: tr('media.sortDescending'),
                  value: 'Descending',
                  active: (filters?.sortOrder ?? 'Descending') === 'Descending',
                },
                {
                  label: tr('media.sortAscending'),
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
    tr,
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
            {...getMediaRailListConfig({
              viewportWidth: viewport.width,
              cardWidth: groupItemWidth,
              gap: theme.spacing.lg,
              horizontalPadding: theme.spacing.page,
            })}
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
    [
      episodeLayout.itemWidth,
      itemWidth,
      theme,
      keyExtractor,
      handleEndReached,
      renderMediaCard,
      viewport.width,
    ],
  );

  if ((query || dataState) && isLoading) {
    return (
      <>
        <NativeListTitle>{title}</NativeListTitle>
        <PageScrollView style={[styles.container, { backgroundColor }]}>
          <SkeletonItemGrid type={type} numColumns={numColumns} itemWidth={itemWidth} gap={gap} />
        </PageScrollView>
      </>
    );
  }

  if ((query || dataState) && isError) {
    return (
      <>
        <NativeListTitle>{title}</NativeListTitle>
        <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
          <View style={styles.errorContainer}>
            <Text
              style={[
                theme.typography.body,
                styles.errorText,
                { color: theme.colors.text, marginBottom: theme.spacing.xl },
              ]}
            >
              {tr('common.loadFailedRetry')}
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
                {tr('common.retry')}
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
        <NativeListTitle>{title}</NativeListTitle>
        <SectionList
          {...gridBatching}
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
              paddingBottom: Platform.OS === 'android' ? tabBarInset : theme.spacing.xl,
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
        <NativeListTitle>{title}</NativeListTitle>
        <FlatList
          {...gridBatching}
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
              paddingBottom: Platform.OS === 'android' ? tabBarInset : 0,
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
                {tr('media.noContent')}
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
      <NativeListTitle>{title}</NativeListTitle>
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
