import { layout, useAppTheme, useMediaHeroHeight } from '@/lib/theme';
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

import { GlassCard, ShadowedGlassCard } from './GlassCard';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.surfaceMuted;
  const shimmerColor = theme.colors.surfaceElevated;

  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
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
    <View
      style={[
        styles.container,
        { width, height, borderRadius, backgroundColor, borderCurve: 'continuous' },
        style,
      ]}
    >
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

export function SkeletonMediaHero() {
  const theme = useAppTheme();

  return (
    <View style={[styles.mediaHero, { backgroundColor: theme.colors.surfaceMuted }]}>
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <View style={styles.mediaHeroOverlay}>
        <Skeleton width="54%" height={40} borderRadius={theme.radius.sm} />
        <View style={styles.mediaHeroMetaRow}>
          <Skeleton width={42} height={20} borderRadius={theme.radius.sm} />
          <Skeleton width={40} height={18} borderRadius={theme.radius.xs} />
          <Skeleton width={54} height={20} borderRadius={theme.radius.sm} />
        </View>
        <View style={styles.mediaHeroDots}>
          <Skeleton width={16} height={7} borderRadius={theme.radius.pill} />
          <Skeleton width={7} height={7} borderRadius={theme.radius.pill} />
          <Skeleton width={7} height={7} borderRadius={theme.radius.pill} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonCard({ type = 'episode' }: { type?: 'episode' | 'series' }) {
  const theme = useAppTheme();
  const cardWidth =
    type === 'episode'
      ? theme.layout.mediaRail.episodeCardWidth
      : theme.layout.mediaRail.posterCardWidth;
  const aspectRatio =
    type === 'episode'
      ? theme.layout.mediaRail.backdropAspectRatio
      : theme.layout.mediaRail.posterAspectRatio;

  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <ShadowedGlassCard radius={theme.radius.md}>
        <Skeleton width="100%" height={cardWidth / aspectRatio} borderRadius={theme.radius.md} />
        <View style={styles.cardCopySkeleton}>
          <Skeleton
            width="85%"
            height={theme.typography.body.lineHeight}
            borderRadius={theme.radius.xs}
          />
          <Skeleton
            width="60%"
            height={theme.typography.footnote.lineHeight}
            borderRadius={theme.radius.xs}
          />
        </View>
      </ShadowedGlassCard>
    </View>
  );
}

export function SkeletonUserViewCard() {
  const theme = useAppTheme();
  const cardWidth = 200;

  return (
    <View style={styles.userViewCard}>
      <ShadowedGlassCard radius={theme.radius.lg}>
        <Skeleton
          width={cardWidth}
          height={cardWidth / theme.layout.mediaRail.backdropAspectRatio}
          borderRadius={theme.radius.md}
        />
        <View style={styles.userViewInfo}>
          <Skeleton
            width="80%"
            height={theme.typography.footnote.lineHeight}
            borderRadius={theme.radius.xs}
          />
        </View>
      </ShadowedGlassCard>
    </View>
  );
}

export function SkeletonSectionHeader() {
  const theme = useAppTheme();

  return (
    <View style={[styles.sectionHeader, { paddingHorizontal: theme.spacing.page }]}>
      <Skeleton
        width={120}
        height={theme.typography.title3.lineHeight}
        borderRadius={theme.radius.xs}
      />
      <Skeleton
        width={60}
        height={theme.typography.footnote.lineHeight}
        borderRadius={theme.radius.xs}
      />
    </View>
  );
}

export function SkeletonFilterBar() {
  const theme = useAppTheme();

  return (
    <View style={styles.filterBar}>
      <ScrollView
        style={{ marginHorizontal: -theme.spacing.page }}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.filterRow,
          { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.page },
        ]}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width={80} height={32} borderRadius={theme.radius.pill} />
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
  const theme = useAppTheme();
  const aspectRatio =
    type === 'episode'
      ? theme.layout.mediaRail.backdropAspectRatio
      : theme.layout.mediaRail.posterAspectRatio;
  const cardHeight = itemWidth / aspectRatio;

  return (
    <View style={[styles.gridItem, { width: itemWidth }]}>
      <Skeleton width="100%" height={cardHeight} borderRadius={theme.radius.md} />
      <Skeleton
        width="85%"
        height={theme.typography.body.lineHeight}
        borderRadius={theme.radius.xs}
        style={styles.gridTitleSkeleton}
      />
      <Skeleton
        width="60%"
        height={theme.typography.footnote.lineHeight}
        borderRadius={theme.radius.xs}
        style={styles.gridSubtitleSkeleton}
      />
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
  const theme = useAppTheme();
  const itemsPerRow = numColumns;
  const totalItems = itemsPerRow * 3; // 显示3行

  return (
    <View style={styles.itemGridContainer}>
      <View
        style={[
          styles.gridContainer,
          {
            paddingHorizontal: theme.spacing.page,
            paddingVertical: theme.spacing.xl,
            rowGap: gap,
          },
        ]}
      >
        {Array.from({ length: totalItems }).map((_, index) => (
          <SkeletonGridItem key={index} type={type} itemWidth={itemWidth} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonDetailHeader() {
  const theme = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const headerHeight = useMediaHeroHeight();
  const logoWidth = Math.min(windowWidth * 0.72, 300);

  return (
    <View
      style={[
        styles.detailHeader,
        { height: headerHeight, backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <Skeleton width="100%" height="100%" borderRadius={0} />
      <Skeleton
        width={logoWidth}
        height={72}
        borderRadius={theme.radius.sm}
        style={{
          position: 'absolute',
          left: (windowWidth - logoWidth) / 2,
          bottom: theme.spacing.xxxl,
        }}
      />
    </View>
  );
}

export function SkeletonDetailContent({
  mode = 'series',
}: {
  mode?: 'series' | 'season' | 'movie' | 'episode';
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.detailContent,
        {
          paddingHorizontal: theme.spacing.page,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Skeleton
        width="80%"
        height={theme.typography.title2.lineHeight}
        borderRadius={theme.radius.xs}
        style={styles.detailTitle}
      />
      <Skeleton
        width="40%"
        height={theme.typography.footnote.lineHeight}
        borderRadius={theme.radius.pill}
        style={styles.detailMeta}
      />

      <View style={styles.detailOverview}>
        <Skeleton
          width="100%"
          height={theme.typography.footnote.lineHeight}
          borderRadius={theme.radius.xs}
        />
        <Skeleton
          width="100%"
          height={theme.typography.footnote.lineHeight}
          borderRadius={theme.radius.xs}
        />
        <Skeleton
          width="100%"
          height={theme.typography.footnote.lineHeight}
          borderRadius={theme.radius.xs}
        />
        <Skeleton
          width="60%"
          height={theme.typography.footnote.lineHeight}
          borderRadius={theme.radius.xs}
        />
      </View>

      <SkeletonDetailInfoCard />

      {(mode === 'movie' || mode === 'episode') && (
        <ShadowedGlassCard
          radius={theme.radius.pill}
          containerStyle={styles.detailPlayButtonShadow}
          style={styles.detailPlayButton}
        >
          <View style={styles.detailPlayButtonContent}>
            <Skeleton width={26} height={26} borderRadius={theme.radius.pill} />
            <Skeleton
              width={112}
              height={theme.typography.footnote.lineHeight}
              borderRadius={theme.radius.xs}
            />
          </View>
        </ShadowedGlassCard>
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

function SkeletonDetailInfoCard() {
  const theme = useAppTheme();

  return (
    <GlassCard radius={theme.radius.lg} style={styles.detailInfo} rimStyle={styles.detailInfoRim}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.detailInfoRow}>
          <Skeleton
            width={48}
            height={theme.typography.footnote.lineHeight}
            borderRadius={theme.radius.xs}
          />
          <Skeleton
            width={index % 2 === 0 ? '70%' : '54%'}
            height={theme.typography.footnote.lineHeight}
            borderRadius={theme.radius.xs}
            style={styles.detailInfoValue}
          />
        </View>
      ))}
    </GlassCard>
  );
}

export function SkeletonHorizontalEpisodes() {
  const theme = useAppTheme();
  const cardWidth = layout.mediaRail.episodeCardWidth - theme.spacing.xl;
  const cardHeight = cardWidth / theme.layout.mediaRail.backdropAspectRatio;
  return (
    <View style={styles.horizontalSection}>
      <Skeleton
        width={120}
        height={theme.typography.title3.lineHeight}
        borderRadius={theme.radius.xs}
        style={styles.sectionTitle}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.horizontalScrollContent,
          { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.page },
        ]}
        style={{ marginHorizontal: -theme.spacing.page }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <View key={index} style={{ width: cardWidth }}>
            <Skeleton width="100%" height={cardHeight} borderRadius={theme.radius.md} />
            <Skeleton
              width="85%"
              height={theme.typography.footnote.lineHeight}
              borderRadius={theme.radius.xs}
              style={styles.gridTitleSkeleton}
            />
            <Skeleton
              width="60%"
              height={theme.typography.caption.lineHeight}
              borderRadius={theme.radius.xs}
              style={styles.gridSubtitleSkeleton}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonHorizontalSection({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <View style={styles.horizontalSection}>
      <Skeleton
        width={120}
        height={theme.typography.title3.lineHeight}
        borderRadius={theme.radius.xs}
        style={styles.sectionTitle}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.horizontalScrollContent,
          { gap: theme.spacing.md, paddingHorizontal: theme.spacing.page },
        ]}
        style={{ marginHorizontal: -theme.spacing.page }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            width={theme.layout.mediaRail.posterCardWidth}
            height={
              theme.layout.mediaRail.posterCardWidth / theme.layout.mediaRail.posterAspectRatio
            }
            borderRadius={theme.radius.md}
            key={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonEpisodeList() {
  const theme = useAppTheme();
  const thumbWidth = 140;

  return (
    <View style={styles.episodeList}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.episodeItem}>
          <Skeleton
            width={thumbWidth}
            height={thumbWidth / theme.layout.mediaRail.backdropAspectRatio}
            borderRadius={theme.radius.md}
          />
          <View style={styles.episodeInfo}>
            <Skeleton
              width="85%"
              height={theme.typography.footnote.lineHeight}
              borderRadius={theme.radius.xs}
            />
            <Skeleton
              width="40%"
              height={theme.typography.caption.lineHeight}
              borderRadius={theme.radius.xs}
            />
            <Skeleton
              width="30%"
              height={theme.typography.caption.lineHeight}
              borderRadius={theme.radius.xs}
            />
          </View>
          <Skeleton width={24} height={24} borderRadius={theme.radius.pill} />
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
  mediaHero: {
    flex: 1,
    overflow: 'hidden',
  },
  mediaHeroOverlay: {
    position: 'absolute',
    left: 56,
    right: 18,
    bottom: 16,
    gap: 8,
  },
  mediaHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaHeroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'transparent',
  },
  cardCopySkeleton: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 2,
  },
  userViewCard: {
    width: 200,
    backgroundColor: 'transparent',
  },
  userViewInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
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
  },
  detailContent: {},
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
    padding: 12,
    rowGap: 6,
  },
  detailInfoRim: {
    borderColor: 'rgba(255,255,255,0.64)',
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailInfoValue: {
    flex: 1,
  },
  detailPlayButtonShadow: {
    marginTop: 8,
    width: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
  },
  detailPlayButton: {
    width: '100%',
  },
  detailPlayButtonContent: {
    minHeight: 46,
    width: '100%',
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
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
