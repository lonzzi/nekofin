import { useAppTheme } from '@/lib/theme';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback } from 'react';
import { FlatList, ListRenderItem, Pressable, StyleSheet, Text, View } from 'react-native';

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

  const renderEpisodeItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <EpisodeCard item={item} style={episodeCardStyle} showPlayButton />,
    [],
  );

  const renderSeriesItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => <SeriesCard item={item} />,
    [],
  );

  const renderItem = type === 'episode' ? renderEpisodeItem : renderSeriesItem;

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
      {isLoading ? (
        <FlatList
          data={skeletonData}
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
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
            暂无内容
          </Text>
        </View>
      )}
    </View>
  );
});

const episodeCardStyle = { width: 220 };
const skeletonData = Array.from({ length: 5 });

const skeletonKeyExtractor = (_: unknown, index: number) => `skeleton-${index}`;
const itemKeyExtractor = (item: MediaItem) => item.id!;
const renderSkeletonItem = () => <SkeletonCard type="episode" />;

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
