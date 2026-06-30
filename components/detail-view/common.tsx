import { layout, radius, spacing, typography, useAppTheme } from '@/lib/design-system';
import { formatChineseDurationFromTicks } from '@/lib/utils';
import { MediaItem } from '@/services/media/types';
import { BottomSheet, RNHostView } from '@expo/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextLayoutEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';
import { GlassCard, ShadowedGlassCard } from '../ui/GlassCard';

const detailDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDetailDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return detailDateFormatter.format(date);
}

function compactList(values?: (string | null | undefined)[] | null, limit = 4) {
  const clean = values?.map((value) => value?.trim()).filter((value): value is string => !!value);
  if (!clean?.length) return '';
  const visible = clean.slice(0, limit).join(', ');
  return clean.length > limit ? `${visible} 等 ${clean.length} 项` : visible;
}

export const PlayButton = ({ item }: { item: MediaItem }) => {
  const router = useRouter();
  const theme = useAppTheme();
  const accentColor = theme.colors.tint;
  const useLiquidGlass = isLiquidGlassAvailable();
  const textColor = useLiquidGlass ? accentColor : theme.colors.inverseText;
  const durationLabel = formatChineseDurationFromTicks(item.runTimeTicks, { largest: 2 });
  const buttonLabel = durationLabel ? `播放 · ${durationLabel}` : '播放';

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
    <ShadowedGlassCard
      radius={radius.pill}
      containerStyle={detailViewStyles.playButtonShadow}
      style={[
        detailViewStyles.playButton,
        useLiquidGlass
          ? { borderColor: `${accentColor}55`, backgroundColor: 'transparent' }
          : { borderColor: accentColor, backgroundColor: accentColor },
      ]}
      isInteractive
      tintColor={useLiquidGlass ? `${accentColor}18` : undefined}
      rimStyle={detailViewStyles.playButtonRim}
    >
      {progressPercent > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            detailViewStyles.playButtonProgressFill,
            {
              backgroundColor: useLiquidGlass ? `${accentColor}26` : accentColor,
              borderRadius: 999,
            },
            animatedStyle,
          ]}
        />
      )}
      <Pressable
        onPress={() => {
          router.push({ pathname: '/player', params: { itemId: item.id! } });
        }}
        style={detailViewStyles.playButtonPressable}
      >
        <View
          style={[
            detailViewStyles.playButtonIcon,
            { backgroundColor: useLiquidGlass ? `${accentColor}18` : 'rgba(255,255,255,0.2)' },
          ]}
        >
          <Ionicons name="play" size={13} color={textColor} />
        </View>
        <Text style={[detailViewStyles.playButtonLabel, { color: textColor }]} numberOfLines={1}>
          {buttonLabel}
        </Text>
      </Pressable>
    </ShadowedGlassCard>
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

  if (!ratingText && !yearText) return null;

  return (
    <GlassCard
      radius={radius.pill}
      style={detailViewStyles.metaPill}
      rimStyle={detailViewStyles.metaPillRim}
    >
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
    </GlassCard>
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

  const infoRows = useMemo(() => {
    const primary = item?.genres && item.genres.length > 0 ? item.genres : undefined;
    const genreText = primary ? primary.join(', ') : '';
    const fallback = item?.genreItems?.map((g) => g.name).filter(Boolean) ?? [];
    const writerText = compactList(
      item?.people?.filter((p) => p?.type === 'Writer').map((p) => p.name),
      3,
    );
    const directorText = compactList(
      item?.people?.filter((p) => p?.type === 'Director').map((p) => p.name),
      3,
    );
    const studioText = compactList(
      item?.studios?.map((s) => s.name),
      3,
    );
    const runtimeText = formatChineseDurationFromTicks(
      item.cumulativeRunTimeTicks ?? item.runTimeTicks,
      { largest: 2 },
    );
    const ratingParts = [
      typeof item.communityRating === 'number' ? `用户 ${item.communityRating.toFixed(1)}` : '',
      typeof item.criticRating === 'number' ? `影评 ${item.criticRating}` : '',
    ].filter(Boolean);
    const countText =
      item.recursiveItemCount || item.childCount
        ? `${item.recursiveItemCount ?? item.childCount} 集`
        : '';

    return [
      { label: '首播', value: formatDetailDate(item.premiereDate) },
      { label: '时长', value: runtimeText },
      { label: '评分', value: ratingParts.join(' · ') },
      { label: '分级', value: item.officialRating ?? '' },
      {
        label: '原名',
        value: item.originalTitle && item.originalTitle !== item.name ? item.originalTitle : '',
      },
      { label: '类型', value: genreText || fallback.join(', ') },
      { label: '标语', value: compactList(item.taglines, 2) },
      { label: '地区', value: compactList(item.productionLocations, 3) },
      { label: '标签', value: compactList(item.tags, 4) },
      { label: '集数', value: countText },
      { label: '导演', value: directorText },
      { label: '编剧', value: writerText },
      { label: '工作室', value: studioText },
    ].filter((row) => row.value);
  }, [item]);

  if (infoRows.length === 0) return null;

  return (
    <GlassCard
      radius={radius.lg}
      style={detailViewStyles.infoBlock}
      rimStyle={detailViewStyles.infoBlockRim}
    >
      {infoRows.map((row) => (
        <View key={row.label} style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>{row.label}</Text>
          <ThemedText style={detailViewStyles.infoValue}>{row.value}</ThemedText>
        </View>
      ))}
    </GlassCard>
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
  metaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metaPillRim: {
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  meta: {
    ...typography.footnote,
    fontWeight: '600',
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
    padding: spacing.md,
    rowGap: spacing.sm,
  },
  infoBlockRim: {
    borderColor: 'rgba(255,255,255,0.64)',
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
  playButtonShadow: {
    marginTop: spacing.xs,
    width: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
  },
  playButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  playButtonRim: {
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  playButtonPressable: {
    minHeight: 46,
    width: '100%',
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButtonIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonLabel: {
    ...typography.footnote,
    fontWeight: '600',
    flexShrink: 1,
  },
  playButtonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sectionBlock: {
    marginTop: spacing.lg,
    overflow: 'visible',
  },
  sectionTitle: {
    ...typography.title3,
    marginBottom: spacing.xs,
  },
  horizontalList: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl - spacing.xs,
    paddingHorizontal: spacing.page + spacing.sm,
    gap: spacing.md,
    overflow: 'visible',
  },
  edgeToEdge: {
    marginTop: -spacing.xs,
    marginBottom: -spacing.sm,
    marginHorizontal: -(spacing.page + spacing.sm),
    overflow: 'visible',
  },
  horizontalCard: {
    width: layout.mediaRail.episodeCardWidth - spacing.xl,
  },
  listContainer: {
    marginTop: spacing.lg,
    rowGap: spacing.lg,
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
