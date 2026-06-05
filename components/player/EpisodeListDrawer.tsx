import { useThemeColor } from '@/hooks/useThemeColor';
import { formatDurationFromTicks } from '@/lib/utils';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Drawer } from 'react-native-drawer-layout';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EpisodeCard } from '../media/Card';
import { usePlayer } from './PlayerContext';

export interface EpisodeListDrawerRef {
  present: () => void;
  dismiss: () => void;
}

export function EpisodeListDrawer({ ref }: { ref: React.RefObject<EpisodeListDrawerRef | null> }) {
  const { episodes, currentItem, onEpisodeSelect } = usePlayer();
  const [open, setOpen] = useState(false);
  const opacity = useSharedValue(0);
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);

  const present = useCallback(() => {
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  useImperativeHandle(ref, () => ({
    present,
    dismiss,
  }));

  useEffect(() => {
    if (open) {
      opacity.value = withTiming(1, { duration: 0 });
    } else {
      opacity.value = withDelay(350, withTiming(0, { duration: 0 }));
    }
  }, [open, opacity]);

  useEffect(() => {
    if (open && currentItem && episodes.length > 0) {
      setTimeout(() => {
        const currentIndex = episodes.findIndex((episode) => episode.id === currentItem.id);
        if (currentIndex >= 0) {
          flatListRef.current?.scrollToIndex({
            index: currentIndex,
            animated: true,
            viewPosition: 0,
          });
        }
      }, 350);
    }
  }, [open, currentItem, episodes]);

  const handleEpisodePress = useCallback(
    (episode: MediaItem) => {
      if (episode.id) {
        onEpisodeSelect(episode.id);
        dismiss();
      }
    },
    [onEpisodeSelect, dismiss],
  );

  const renderEpisodeItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const isCurrentEpisode = currentItem?.id === item.id;

      return (
        <Pressable
          style={[styles.episodeItem, isCurrentEpisode && styles.currentEpisodeItem]}
          onPress={() => handleEpisodePress(item)}
        >
          <View style={styles.episodeContent}>
            <EpisodeCard
              item={item}
              style={{ width: 140 }}
              hideText
              showBorder={false}
              disableContextMenu
              disabled
              imgType="Primary"
            />
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeTitle} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[styles.episodeMeta, { color: subtitleColor }]}>
                {`S${item.parentIndexNumber}E${item.indexNumber}`}
              </Text>
              <Text style={[styles.episodeMeta, { color: subtitleColor }]}>
                {formatDurationFromTicks(item.runTimeTicks ?? 0)}
              </Text>
              {item.overview && (
                <Text style={[styles.episodeOverview, { color: subtitleColor }]} numberOfLines={2}>
                  {item.overview.trim()}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [currentItem?.id, handleEpisodePress, subtitleColor],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}
      pointerEvents={open ? 'box-none' : 'none'}
    >
      <Drawer
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        drawerPosition="right"
        drawerStyle={[styles.drawer, { width: screenWidth * 0.4 }]}
        overlayStyle={styles.overlay}
        swipeEnabled={false}
        drawerType="front"
        renderDrawerContent={() => (
          <View style={styles.drawerContent} pointerEvents="auto">
            <View style={styles.header}>
              <Text style={styles.headerTitle}>剧集列表</Text>
              <Pressable onPress={dismiss} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <FlatList
              ref={flatListRef}
              data={episodes}
              renderItem={renderEpisodeItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />
          </View>
        )}
      >
        <View style={{ flex: 1 }} pointerEvents="none" />
      </Drawer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 10,
  },
  drawerContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  episodeItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  currentEpisodeItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  episodeContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
  },
  episodeInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 4,
    color: '#fff',
  },
  episodeMeta: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  episodeOverview: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 4,
  },
  markButton: {
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
});
