import { layout, radius, spacing, typography, useAppTheme } from '@/lib/design-system';
import { formatDurationFromTicks } from '@/lib/utils';
import { MediaItem } from '@/services/media/types';
import { BottomSheet, RNHostView } from '@expo/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextLayoutEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';

export const PlayButton = ({ item }: { item: MediaItem }) => {
  const router = useRouter();
  const theme = useAppTheme();
  const accentColor = theme.colors.tint;
  const textColor = theme.colors.inverseText;

  const progressPercent = useMemo(() => {
    const pct = item.userData?.playedPercentage ?? (item.userData?.played ? 100 : 0);
    if (typeof pct === 'number' && !Number.isNaN(pct)) {
      return Math.max(0, Math.min(100, pct));
    }
    const pos = item.userData?.playbackPositionTicks ?? 0;
    const duration = item.runTimeTicks ?? 0;
    if (pos > 0 && duration > 0) {
      return Math.max(0, Math.min(100, (pos / duration) * 100));
    }
    return 0;
  }, [item]);

  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(progressPercent, {
      duration: 800,
    });
  }, [progressPercent, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <GlassView
      style={[
        detailViewStyles.playButton,
        { borderColor: accentColor, backgroundColor: accentColor },
        isLiquidGlassAvailable() && { borderRadius: 999, backgroundColor: 'transparent' },
      ]}
      isInteractive
      tintColor={`${accentColor}20`}
    >
      {progressPercent > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            detailViewStyles.playButtonProgressFill,
            {
              backgroundColor: accentColor,
              borderRadius: isLiquidGlassAvailable() ? 999 : 8,
            },
            animatedStyle,
          ]}
        />
      )}
      <Pressable
        onPress={() => {
          router.push({ pathname: '/player', params: { itemId: item.id! } });
        }}
        style={{
          paddingVertical: 12,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[detailViewStyles.playButtonText, { color: textColor }]}>
            {item.runTimeTicks
              ? formatDurationFromTicks(item.runTimeTicks, { showUnits: true })
              : '播放'}
          </Text>
          <Ionicons name="play-circle" size={24} color={textColor} />
        </View>
      </Pressable>
    </GlassView>
  );
};

export const ItemMeta = ({ item }: { item: MediaItem }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;

  const ratingText = useMemo(() => {
    if (typeof item?.communityRating === 'number') return item.communityRating.toFixed(1);
    if (typeof item?.criticRating === 'number') return String(item.criticRating);
    if (item?.officialRating) return item.officialRating;
    return '';
  }, [item?.communityRating, item?.criticRating, item?.officialRating]);

  const yearText = useMemo(() => {
    return typeof item?.productionYear === 'number' ? String(item.productionYear) : '';
  }, [item?.productionYear]);

  return (
    <Text style={[detailViewStyles.meta, { color: textColor }]}>
      {ratingText ? (
        <>
          <Text style={detailViewStyles.star}>★</Text>
          <Text>{` ${ratingText}`}</Text>
          {yearText ? <Text>{` · ${yearText}`}</Text> : null}
        </>
      ) : (
        <>{yearText}</>
      )}
    </Text>
  );
};

export const ItemOverview = ({ item }: { item: MediaItem }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const [isOverviewPresented, setIsOverviewPresented] = useState(false);
  const [textLines, setTextLines] = useState(0);
  const accentColor = theme.colors.tint;

  const overview = item?.overview?.trim() ?? '';

  const handleShowMore = () => {
    setIsOverviewPresented(true);
  };

  const handleTextLayout = (event: TextLayoutEvent) => {
    setTextLines(event.nativeEvent.lines.length);
  };

  if (!overview) return null;

  return (
    <>
      <View style={detailViewStyles.overviewContainer}>
        <Text
          style={[detailViewStyles.overview, { opacity: 0, position: 'absolute' }]}
          onTextLayout={handleTextLayout}
        >
          {overview}
        </Text>
        <Text style={[detailViewStyles.overview, { color: textColor }]} numberOfLines={5}>
          {overview}
        </Text>
        {textLines > 5 && (
          <Pressable onPress={handleShowMore}>
            <Text style={[detailViewStyles.overview, { color: accentColor }]}>查看更多</Text>
          </Pressable>
        )}
      </View>

      <BottomSheet
        isPresented={isOverviewPresented}
        onDismiss={() => setIsOverviewPresented(false)}
        testID="item-overview-sheet"
      >
        <RNHostView matchContents>
          <View style={detailViewStyles.modalContent}>
            <Text style={[detailViewStyles.modalTitle, { color: textColor }]}>剧情简介</Text>
            <Text style={[detailViewStyles.modalOverview, { color: textColor }]}>{overview}</Text>
          </View>
        </RNHostView>
      </BottomSheet>
    </>
  );
};

export const ItemInfoList = ({ item }: { item: MediaItem }) => {
  const theme = useAppTheme();
  const subtitleColor = theme.colors.textSecondary;

  const genreText = useMemo(() => {
    const primary = item?.genres && item.genres.length > 0 ? item.genres : undefined;
    if (primary) return primary.join(', ');
    const fallback = item?.genreItems?.map((g) => g.name).filter(Boolean) ?? [];
    return fallback.join(', ');
  }, [item?.genreItems, item?.genres]);

  const writerText = useMemo(() => {
    const people = item?.people?.filter((p) => p?.type === 'Writer').map((p) => p.name) ?? [];
    return people.filter(Boolean).join(', ');
  }, [item?.people]);

  const studioText = useMemo(() => {
    const studios = item?.studios?.map((s) => s.name) ?? [];
    return studios.filter(Boolean).join(', ');
  }, [item?.studios]);

  if (!genreText && !writerText && !studioText) return null;

  return (
    <View style={detailViewStyles.infoBlock}>
      {!!genreText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>类型</Text>
          <ThemedText style={detailViewStyles.infoValue}>{genreText}</ThemedText>
        </View>
      )}
      {!!writerText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>编剧</Text>
          <ThemedText style={detailViewStyles.infoValue}>{writerText}</ThemedText>
        </View>
      )}
      {!!studioText && (
        <View style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>工作室</Text>
          <ThemedText style={detailViewStyles.infoValue}>{studioText}</ThemedText>
        </View>
      )}
    </View>
  );
};

export const detailViewStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  headerMedia: {
    width: '100%',
    height: '100%',
  },
  headerScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
  },
  headerLogo: {
    position: 'absolute',
    height: 76,
  },
  content: {
    paddingHorizontal: spacing.page,
    gap: spacing.sm,
  },
  meta: {
    ...typography.footnote,
  },
  star: {
    color: '#F5C518',
  },
  overview: {
    ...typography.footnote,
    lineHeight: 20,
  },
  overviewContainer: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalContent: {
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.page,
    gap: spacing.lg,
  },
  modalTitle: {
    ...typography.title3,
  },
  modalOverview: {
    ...typography.body,
    lineHeight: 24,
  },
  infoBlock: {
    marginTop: spacing.xs,
    rowGap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  infoLabel: {
    ...typography.footnote,
    width: 56,
  },
  infoValue: {
    ...typography.footnote,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  playButton: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  playButtonText: {
    ...typography.bodyEmphasized,
  },
  playButtonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sectionBlock: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.title3,
    marginBottom: spacing.sm,
  },
  horizontalList: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.page,
    gap: spacing.md,
  },
  edgeToEdge: {
    marginHorizontal: -spacing.page,
  },
  horizontalCard: {
    width: layout.mediaRail.episodeCardWidth - spacing.xl,
  },
  listContainer: {
    marginTop: spacing.xl,
    rowGap: spacing.xl,
  },
  listItem: {
    width: '100%',
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    opacity: 0.6,
  },
  lastLineContainer: {
    marginTop: -spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
