import { useThemeColor } from '@/hooks/useThemeColor';
import { useEffect, useRef } from 'react';
import {
  Animated,
  DimensionValue,
  ScrollView,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const backgroundColor = useThemeColor({ light: '#f0f0f0', dark: '#2a2a2a' }, 'background');
  const shimmerColor = useThemeColor({ light: '#e0e0e0', dark: '#3a3a3a' }, 'background');

  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]),
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnimation]);

  const shimmerStyle = {
    opacity: shimmerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    }),
  };

  return (
    <View style={[styles.container, { width, height, borderRadius, backgroundColor }, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: shimmerColor,
            borderRadius,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

export function SkeletonCard({ type = 'episode' }: { type?: 'episode' | 'series' }) {
  const cardWidth = type === 'episode' ? 220 : 120;
  const aspectRatio = type === 'episode' ? 16 / 9 : 2 / 3;

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <Skeleton width="100%" height={cardWidth / aspectRatio} borderRadius={12} />
      <Skeleton width="85%" height={16} borderRadius={4} style={styles.titleSkeleton} />
      <Skeleton width="60%" height={13} borderRadius={4} style={styles.subtitleSkeleton} />
    </View>
  );
}

export function SkeletonUserViewCard() {
  return (
    <View style={styles.userViewCard}>
      <Skeleton width={200} height={200 / (16 / 9)} borderRadius={12} />
      <View style={styles.userViewInfo}>
        <Skeleton width="80%" height={14} borderRadius={4} />
      </View>
    </View>
  );
}

export function SkeletonSectionHeader() {
  return (
    <View style={styles.sectionHeader}>
      <Skeleton width={120} height={24} borderRadius={4} />
      <Skeleton width={60} height={16} borderRadius={4} />
    </View>
  );
}

export function SkeletonFilterBar() {
  return (
    <View style={styles.filterBar}>
      <ScrollView
        style={{ marginHorizontal: -20 }}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width={80} height={32} borderRadius={16} />
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonGridItem({
  type = 'episode',
  itemWidth,
}: {
  type?: 'episode' | 'series';
  itemWidth: number;
}) {
  const aspectRatio = type === 'episode' ? 16 / 9 : 2 / 3;
  const cardHeight = itemWidth / aspectRatio;

  return (
    <View style={[styles.gridItem, { width: itemWidth }]}>
      <Skeleton width="100%" height={cardHeight} borderRadius={12} />
      <Skeleton width="85%" height={16} borderRadius={4} style={styles.gridTitleSkeleton} />
      <Skeleton width="60%" height={13} borderRadius={4} style={styles.gridSubtitleSkeleton} />
    </View>
  );
}

export function SkeletonItemGrid({
  type = 'episode',
  numColumns,
  itemWidth,
  gap,
}: {
  type?: 'episode' | 'series';
  numColumns: number;
  itemWidth: number;
  gap: number;
}) {
  const itemsPerRow = numColumns;
  const totalItems = itemsPerRow * 3; // 显示3行

  return (
    <View style={styles.itemGridContainer}>
      <View
        style={[styles.gridContainer, { paddingHorizontal: 20, paddingVertical: 20, rowGap: 16 }]}
      >
        {Array.from({ length: totalItems }).map((_, index) => (
          <SkeletonGridItem key={index} type={type} itemWidth={itemWidth} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonDetailHeader() {
  const { height: windowHeight } = useWindowDimensions();
  const headerHeight = windowHeight * 0.6;

  return <View style={[styles.detailHeader, { height: headerHeight }]} />;
}

export function SkeletonDetailContent({
  mode = 'series',
}: {
  mode?: 'series' | 'season' | 'movie' | 'episode';
}) {
  return (
    <View style={styles.detailContent}>
      <Skeleton width="80%" height={32} borderRadius={4} style={styles.detailTitle} />
      <Skeleton width="40%" height={16} borderRadius={4} style={styles.detailMeta} />

      <View style={styles.detailOverview}>
        <Skeleton width="100%" height={16} borderRadius={4} />
        <Skeleton width="100%" height={16} borderRadius={4} />
        <Skeleton width="100%" height={16} borderRadius={4} />
        <Skeleton width="60%" height={16} borderRadius={4} />
      </View>

      <View style={styles.detailInfo}>
        <Skeleton width="30%" height={14} borderRadius={4} />
        <Skeleton width="70%" height={14} borderRadius={4} />
        <Skeleton width="25%" height={14} borderRadius={4} />
        <Skeleton width="75%" height={14} borderRadius={4} />
      </View>

      {(mode === 'movie' || mode === 'episode') && (
        <Skeleton width={120} height={44} borderRadius={8} style={styles.detailPlayButton} />
      )}

      {mode === 'season' && <SkeletonEpisodeList />}

      {mode === 'episode' && (
        <>
          <SkeletonHorizontalEpisodes />
          <SkeletonHorizontalSection title="季度" />
          <SkeletonHorizontalSection title="演职人员" />
          <SkeletonHorizontalSection title="更多类似的" />
        </>
      )}
    </View>
  );
}

export function SkeletonHorizontalEpisodes() {
  const cardWidth = 200;
  const cardHeight = cardWidth / (16 / 9);
  return (
    <View style={styles.horizontalSection}>
      <Skeleton width={120} height={24} borderRadius={4} style={styles.sectionTitle} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        style={{ marginHorizontal: -20 }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={{ width: cardWidth }}>
            <Skeleton width="100%" height={cardHeight} borderRadius={12} />
            <Skeleton width="85%" height={16} borderRadius={4} style={styles.gridTitleSkeleton} />
            <Skeleton
              width="60%"
              height={13}
              borderRadius={4}
              style={styles.gridSubtitleSkeleton}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonHorizontalSection({ title }: { title: string }) {
  return (
    <View style={styles.horizontalSection}>
      <Skeleton width={120} height={24} borderRadius={4} style={styles.sectionTitle} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        style={{ marginHorizontal: -20 }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton width={140} height={200} borderRadius={12} key={index} />
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonEpisodeList() {
  return (
    <View style={styles.episodeList}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.episodeItem}>
          <Skeleton width={140} height={80} borderRadius={8} />
          <View style={styles.episodeInfo}>
            <Skeleton width="85%" height={16} borderRadius={4} />
            <Skeleton width="40%" height={12} borderRadius={4} />
            <Skeleton width="30%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    overflow: 'hidden',
  },
  titleSkeleton: {
    marginTop: 8,
    marginHorizontal: 8,
  },
  subtitleSkeleton: {
    marginTop: 2,
    marginHorizontal: 8,
  },
  userViewCard: {
    overflow: 'hidden',
  },
  userViewInfo: {
    padding: 8,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterBar: {
    paddingBottom: 8,
    gap: 8,
  },
  filterRow: {
    flexDirection: 'row',
    columnGap: 8,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  gridItem: {
    overflow: 'hidden',
  },
  gridTitleSkeleton: {
    marginTop: 8,
    marginHorizontal: 8,
  },
  gridSubtitleSkeleton: {
    marginTop: 2,
    marginHorizontal: 8,
  },
  itemGridContainer: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailHeader: {
    width: '100%',
    height: 520,
  },
  detailContent: {
    top: -140,
    padding: 20,
    gap: 8,
  },
  detailLogo: {},
  detailTitle: {
    marginTop: 8,
  },
  detailMeta: {
    marginTop: 4,
  },
  detailOverview: {
    gap: 4,
    marginTop: 8,
  },
  detailInfo: {
    marginTop: 6,
    rowGap: 6,
  },
  detailPlayButton: {
    marginTop: 8,
  },
  horizontalSection: {
    marginTop: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  horizontalScrollContent: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    gap: 8,
  },
  episodeList: {
    marginTop: 16,
    rowGap: 16,
  },
  episodeItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  episodeInfo: {
    flex: 1,
    gap: 4,
  },
});
