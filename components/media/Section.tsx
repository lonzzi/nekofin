import { useThemeColor } from '@/hooks/useThemeColor';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback } from 'react';
import { FlatList, ListRenderItem, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

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
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.8}>
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, { color: textColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <View style={styles.viewAllButton}>
              <Ionicons name="chevron-forward" size={20} color={textColor} />
            </View>
          </View>
        </TouchableOpacity>
      )}
      {isLoading ? (
        <FlatList
          data={skeletonData}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionListContent}
          renderItem={renderSkeletonItem}
          keyExtractor={skeletonKeyExtractor}
        />
      ) : items.length > 0 ? (
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionListContent}
          renderItem={renderItem}
          keyExtractor={itemKeyExtractor}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>暂无内容</Text>
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
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
  sectionListContent: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    gap: 12,
  },
  loadingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
