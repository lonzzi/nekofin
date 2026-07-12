import { getHomeRailListConfig } from '@/components/home/homePerformanceConfig';
import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeGlassContainer } from '../ui/GlassCard';
import { SkeletonCard, SkeletonSectionHeader } from '../ui/Skeleton';
import { EpisodeCard, SeriesCard } from './Card';

export const Section = React.memo(function Section({
  title,
  onViewAll,
  items,
  isLoading,
  type = 'episode',
}: {
  title: string;
  onViewAll: () => void;
  items: MediaItem[];
  isLoading: boolean;
  type?: 'episode' | 'series';
}) {
  const theme = useAppTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const listPerformanceConfig = useMemo(
    () =>
      getHomeRailListConfig({
        gap: theme.spacing.md,
        horizontalPadding: theme.spacing.page,
        type,
        viewportWidth,
      }),
    [theme.spacing.md, theme.spacing.page, type, viewportWidth],
  );
  const skeletonItems = useMemo(
    () => Array.from({ length: listPerformanceConfig.initialNumToRender }),
    [listPerformanceConfig.initialNumToRender],
  );

  const renderEpisodeItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <EpisodeCard item={item} style={episodeCardStyle} showPlayButton />,
    [],
  );

  const renderSeriesItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <SeriesCard item={item} />,
    [],
  );

  const renderSkeletonItem = useCallback(() => <SkeletonCard type={type} />, [type]);

  const renderItem = type === 'episode' ? renderEpisodeItem : renderSeriesItem;
  const listContent = isLoading ? (
    <FlatList
      {...listPerformanceConfig}
      data={skeletonItems}
      horizontal
      removeClippedSubviews={false}
      showsHorizontalScrollIndicator={false}
      style={styles.sectionList}
      contentContainerStyle={[
        styles.sectionListContent,
        { gap: theme.spacing.md, paddingHorizontal: theme.spacing.page },
      ]}
      renderItem={renderSkeletonItem}
      keyExtractor={skeletonKeyExtractor}
    />
  ) : items.length > 0 ? (
    <FlatList
      {...listPerformanceConfig}
      data={items}
      horizontal
      removeClippedSubviews={false}
      showsHorizontalScrollIndicator={false}
      style={styles.sectionList}
      contentContainerStyle={[
        styles.sectionListContent,
        { gap: theme.spacing.md, paddingHorizontal: theme.spacing.page },
      ]}
      renderItem={renderItem}
      keyExtractor={itemKeyExtractor}
    />
  ) : (
    <View style={[styles.emptyContainer, { paddingHorizontal: theme.spacing.page }]}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>暂无内容</Text>
    </View>
  );

  const hasListItems = isLoading || items.length > 0;
  const renderedList = hasListItems ? (
    <SafeGlassContainer spacing={0} style={styles.glassGroup}>
      {listContent}
    </SafeGlassContainer>
  ) : (
    listContent
  );

  return (
    <View>
      {isLoading ? (
        <SkeletonSectionHeader />
      ) : (
        <Pressable onPress={onViewAll}>
          <View style={[styles.sectionHeader, { paddingHorizontal: theme.spacing.page }]}>
            <Text
              style={[theme.typography.title3, styles.sectionTitle, { color: theme.colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <View style={styles.viewAllButton}>
              <Ionicons
                name="chevron-forward"
                size={theme.sizes.iconMd}
                color={theme.colors.text}
              />
            </View>
          </View>
        </Pressable>
      )}
      {renderedList}
    </View>
  );
});

const episodeCardStyle = { width: 220 };
const skeletonKeyExtractor = (_: unknown, index: number) => `skeleton-${index}`;
const itemKeyExtractor = (item: MediaItem) => item.id!;
const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    marginRight: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  viewAllText: {
    fontSize: 16,
  },
  sectionList: {
    marginBottom: -8,
    overflow: 'visible',
  },
  sectionListContent: {
    paddingTop: 10,
    paddingBottom: 26,
    overflow: 'visible',
  },
  glassGroup: {
    overflow: 'visible',
  },
  loadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
});
