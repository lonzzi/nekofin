import { useAppTheme } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { ShadowedGlassCard } from './GlassCard';

const sharedShimmerAnimation = new Animated.Value(0);
let shimmerLoop: Animated.CompositeAnimation | null = null;
let shimmerSubscriberCount = 0;

const sharedSweepAnimation = new Animated.Value(0);
let sweepLoop: Animated.CompositeAnimation | null = null;
let sweepSubscriberCount = 0;

function subscribeToSharedSweep() {
  sweepSubscriberCount += 1;
  if (!sweepLoop) {
    sharedSweepAnimation.setValue(0);
    sweepLoop = Animated.loop(
      Animated.timing(sharedSweepAnimation, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    sweepLoop.start();
  }
  return () => {
    sweepSubscriberCount = Math.max(0, sweepSubscriberCount - 1);
    if (sweepSubscriberCount === 0) {
      sweepLoop?.stop();
      sweepLoop = null;
    }
  };
}

function startSharedShimmer() {
  if (shimmerLoop) return;

  sharedShimmerAnimation.setValue(0);
  shimmerLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedShimmerAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(sharedShimmerAnimation, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ]),
  );
  shimmerLoop.start();
}

function stopSharedShimmer() {
  if (shimmerSubscriberCount > 0 || !shimmerLoop) return;

  shimmerLoop.stop();
  shimmerLoop = null;
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'subtle';
}

export function Skeleton({ tone = 'default', ...props }: SkeletonProps) {
  return tone === 'subtle' ? <SubtleSkeleton {...props} /> : <SurfaceSkeleton {...props} />;
}

// A translucent neutral fill lets the detail artwork show through. Only the
// broad gradient moves; no layout or backdrop blur is recomputed per frame.
function SubtleSkeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const theme = useAppTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const fill = theme.isDark ? 'rgba(173,185,204,0.13)' : 'rgba(66,75,89,0.14)';
  const clear = theme.isDark ? 'rgba(207,217,232,0)' : 'rgba(76,88,105,0)';
  const wave = theme.isDark ? 'rgba(207,217,232,0.13)' : 'rgba(76,88,105,0.15)';
  const waveWidth = measuredWidth * 0.8;

  useEffect(subscribeToSharedSweep, []);

  return (
    <View
      onLayout={({ nativeEvent }) => setMeasuredWidth(nativeEvent.layout.width)}
      style={[
        styles.container,
        { width, height, borderRadius, backgroundColor: fill, borderCurve: 'continuous' },
        style,
      ]}
    >
      {measuredWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            {
              width: waveWidth,
              transform: [
                {
                  translateX: sharedSweepAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-waveWidth, measuredWidth],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[clear, wave, clear]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function SurfaceSkeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const theme = useAppTheme();
  const backgroundColor = theme.colors.surfaceMuted;
  const shimmerColor = theme.colors.surfaceElevated;

  useEffect(() => {
    shimmerSubscriberCount += 1;
    startSharedShimmer();

    return () => {
      shimmerSubscriberCount = Math.max(0, shimmerSubscriberCount - 1);
      stopSharedShimmer();
    };
  }, []);

  const shimmerStyle = {
    opacity: sharedShimmerAnimation.interpolate({
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

// Let native text measure the line, including the user's font scale. Callers
// supply the same typography as their content instead of a second line height.
export function SkeletonText({
  width = '100%',
  textStyle,
}: {
  width?: DimensionValue;
  textStyle?: StyleProp<TextStyle>;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ width, alignSelf: 'flex-start' }}>
      <Text style={[textStyle ?? theme.typography.body, { color: 'transparent' }]}> </Text>
      <View style={[StyleSheet.absoluteFill, { paddingVertical: 3 }]}>
        <Skeleton tone="subtle" height="100%" borderRadius={theme.radius.xs} />
      </View>
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
      <ShadowedGlassCard radius={theme.radius.md} surface="transparent">
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
      <ShadowedGlassCard radius={theme.radius.lg} surface="transparent">
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

export function SkeletonHorizontalSection() {
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
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
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
});
