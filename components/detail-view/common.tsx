import { layout, radius, spacing, typography, useAppTheme } from '@/lib/design-system';
import { formatChineseDurationFromTicks } from '@/lib/utils';
import { MediaItem } from '@/services/media/types';
import { BottomSheet, RNHostView } from '@expo/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextLayoutEvent, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '../ThemedText';

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
    <View style={detailViewStyles.playButtonShadow}>
      <GlassView
        style={[
          detailViewStyles.playButton,
          useLiquidGlass
            ? { borderColor: `${accentColor}55`, backgroundColor: 'transparent' }
            : { borderColor: accentColor, backgroundColor: accentColor },
        ]}
        glassEffectStyle="regular"
        isInteractive
        tintColor={useLiquidGlass ? `${accentColor}18` : undefined}
      >
        <View pointerEvents="none" style={detailViewStyles.playButtonRim} />
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
          <View style={detailViewStyles.playButtonContent}>
            <Ionicons name="play-circle" size={24} color={textColor} />
            <View style={detailViewStyles.playButtonCopy}>
              <Text style={[detailViewStyles.playButtonText, { color: textColor }]}>播放</Text>
              {!!durationLabel && (
                <Text style={[detailViewStyles.playButtonSubtitle, { color: textColor }]}>
                  {durationLabel}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      </GlassView>
    </View>
  );
};

export const ItemMeta = ({ item }: { item: MediaItem }) => {
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const useLiquidGlass = isLiquidGlassAvailable();

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
    <GlassView
      style={[
        detailViewStyles.metaPill,
        !useLiquidGlass && { backgroundColor: theme.colors.surface },
      ]}
      glassEffectStyle="regular"
      tintColor="rgba(255,255,255,0.10)"
    >
      <View pointerEvents="none" style={detailViewStyles.metaPillRim} />
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
    </GlassView>
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
  const useLiquidGlass = isLiquidGlassAvailable();

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
    <GlassView
      style={[
        detailViewStyles.infoBlock,
        !useLiquidGlass && { backgroundColor: theme.colors.surface },
      ]}
      glassEffectStyle="regular"
      tintColor="rgba(255,255,255,0.10)"
    >
      <View pointerEvents="none" style={detailViewStyles.infoBlockRim} />
      {infoRows.map((row) => (
        <View key={row.label} style={detailViewStyles.infoRow}>
          <Text style={[detailViewStyles.infoLabel, { color: subtitleColor }]}>{row.label}</Text>
          <ThemedText style={detailViewStyles.infoValue}>{row.value}</ThemedText>
        </View>
      ))}
    </GlassView>
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
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metaPillRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: spacing.md,
    rowGap: spacing.sm,
  },
  infoBlockRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.64)',
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  playButton: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  playButtonRim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  playButtonPressable: {
    paddingVertical: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButtonCopy: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  playButtonText: {
    ...typography.bodyEmphasized,
  },
  playButtonSubtitle: {
    ...typography.caption,
    fontWeight: '600',
    opacity: 0.72,
  },
  playButtonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sectionBlock: {
    marginTop: spacing.xl,
    overflow: 'visible',
  },
  sectionTitle: {
    ...typography.title3,
    marginBottom: spacing.sm,
  },
  horizontalList: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.page + spacing.md,
    gap: spacing.md,
    overflow: 'visible',
  },
  edgeToEdge: {
    marginTop: -spacing.md,
    marginHorizontal: -(spacing.page + spacing.md),
    overflow: 'visible',
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
