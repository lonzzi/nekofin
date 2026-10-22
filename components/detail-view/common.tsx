import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { t as tr, useTranslation } from '@/lib/i18n';
import { layout, radius, spacing, typography, useAppTheme } from '@/lib/theme';
import { formatChineseDurationFromTicks, formatRating } from '@/lib/utils';
import {
  playbackSelectionParams,
  type PlaybackSelection,
} from '@/services/media/playbackSelection';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextLayoutEvent,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GlassCard, ShadowedGlassCard } from '../ui/GlassCard';
import { InfoCard, InfoCardRows } from '../ui/InfoCard';
import { OverviewSheet } from './OverviewSheet';

const detailDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const OVERVIEW_COLLAPSED_LINES = 5;

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
  return clean.length > limit
    ? tr('common.visibleItemSummary', { visible: visible, count: clean.length })
    : visible;
}

export const PlayButton = ({
  item,
  selection,
  containerStyle,
}: {
  item: MediaItem;
  selection?: PlaybackSelection;
  containerStyle?: StyleProp<ViewStyle>;
}) => {
  const { t: tr } = useTranslation();
  const router = useTracedRouter('detail-play');
  const theme = useAppTheme();
  const accentColor = theme.colors.tint;
  const useLiquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const textColor = useLiquidGlass ? accentColor : theme.colors.inverseText;
  const durationLabel = formatChineseDurationFromTicks(item.runTimeTicks, { largest: 2 });
  const buttonLabel = durationLabel
    ? tr('player.playWithDuration', { durationLabel: durationLabel })
    : tr('player.play');

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

  const progressScale = useSharedValue(0);

  useEffect(() => {
    progressScale.value = withTiming(progressPercent / 100, {
      duration: 800,
    });
  }, [progressPercent, progressScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressScale.value }],
  }));

  return (
    <ShadowedGlassCard
      radius={radius.pill}
      containerStyle={[detailViewStyles.playButtonShadow, containerStyle]}
      style={[
        detailViewStyles.playButton,
        useLiquidGlass ? { backgroundColor: 'transparent' } : { backgroundColor: accentColor },
      ]}
      fallbackBackgroundColor={accentColor}
      isInteractive
      tintColor={useLiquidGlass ? `${accentColor}18` : undefined}
      useGlassEffect
    >
      {progressPercent > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            detailViewStyles.playButtonProgressFill,
            {
              backgroundColor: useLiquidGlass ? `${accentColor}26` : 'rgba(255,255,255,0.18)',
              borderRadius: 999,
            },
            animatedStyle,
          ]}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        onPress={() => {
          router.push({
            pathname: '/player',
            params: { itemId: item.id!, ...playbackSelectionParams(selection) },
          });
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

  const ratingText =
    typeof item.communityRating === 'number'
      ? formatRating(item.communityRating)
      : typeof item.criticRating === 'number'
        ? String(item.criticRating)
        : (item.officialRating ?? '');
  const yearText = typeof item.productionYear === 'number' ? String(item.productionYear) : '';

  if (!ratingText && !yearText) return null;

  return (
    <GlassCard radius={radius.pill} style={detailViewStyles.metaPill} surface="material">
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

export const ItemOverview = ({
  item,
  showEmptyPlaceholder = false,
}: {
  item: MediaItem;
  showEmptyPlaceholder?: boolean;
}) => {
  const { t: tr } = useTranslation();
  const theme = useAppTheme();
  const textColor = theme.colors.text;
  const [isOverviewPresented, setIsOverviewPresented] = useState(false);
  const [measuredOverview, setMeasuredOverview] = useState({ lines: 0, text: '' });
  const accentColor = theme.colors.tint;

  const overview = item?.overview?.trim() ?? '';
  const textLines = measuredOverview.text === overview ? measuredOverview.lines : 0;

  const handleShowMore = () => {
    setIsOverviewPresented(true);
  };

  const handleTextLayout = (event: TextLayoutEvent) => {
    setMeasuredOverview({
      lines: event.nativeEvent.lines.length,
      text: overview,
    });
  };

  if (!overview) {
    if (!showEmptyPlaceholder) return null;

    return (
      <View style={detailViewStyles.overviewContainer}>
        <Text style={[detailViewStyles.overview, { color: theme.colors.textTertiary }]}>
          {tr('media.noOverview')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={detailViewStyles.overviewContainer}>
        <Text
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[detailViewStyles.overview, { opacity: 0, position: 'absolute' }]}
          onTextLayout={handleTextLayout}
        >
          {overview}
        </Text>
        <Text
          style={[detailViewStyles.overview, { color: textColor }]}
          numberOfLines={OVERVIEW_COLLAPSED_LINES}
        >
          {overview}
        </Text>
        {textLines > OVERVIEW_COLLAPSED_LINES ? (
          <Pressable
            onPress={handleShowMore}
            accessibilityRole="button"
            accessibilityLabel={tr('media.readFullOverview')}
          >
            <Text style={[detailViewStyles.overview, { color: accentColor }]}>
              {tr('media.readMore')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <OverviewSheet
        overview={overview}
        isPresented={isOverviewPresented}
        onDismiss={() => setIsOverviewPresented(false)}
      />
    </>
  );
};

export const ItemInfoList = ({ item }: { item: MediaItem }) => {
  const { t: tr } = useTranslation();
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
      typeof item.communityRating === 'number'
        ? tr('server.userWithIndex', { value: formatRating(item.communityRating) })
        : '',
      typeof item.criticRating === 'number'
        ? tr('media.criticRating', { criticRating: item.criticRating })
        : '',
    ].filter(Boolean);
    const countText =
      item.recursiveItemCount || item.childCount
        ? tr('media.episodeCount', { value: item.recursiveItemCount ?? item.childCount })
        : '';

    return [
      { label: tr('media.premiere'), value: formatDetailDate(item.premiereDate) },
      { label: tr('media.duration'), value: runtimeText },
      { label: tr('media.rating'), value: ratingParts.join(' · ') },
      { label: tr('media.certification'), value: item.officialRating ?? '' },
      {
        label: tr('media.originalTitle'),
        value: item.originalTitle && item.originalTitle !== item.name ? item.originalTitle : '',
      },
      { label: tr('media.genre'), value: genreText || fallback.join(', ') },
      { label: tr('media.tagline'), value: compactList(item.taglines, 2) },
      { label: tr('media.region'), value: compactList(item.productionLocations, 3) },
      { label: tr('media.tags'), value: compactList(item.tags, 4) },
      { label: tr('player.episodes'), value: countText },
      { label: tr('media.director'), value: directorText },
      { label: tr('media.writer'), value: writerText },
      { label: tr('media.studios'), value: studioText },
    ].filter((row) => row.value);
  }, [item, tr]);

  if (infoRows.length === 0) return null;

  return (
    <InfoCard style={detailViewStyles.infoBlock}>
      <InfoCardRows rows={infoRows} />
    </InfoCard>
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
  infoBlock: {
    marginTop: spacing.xs,
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
    width: '100%',
    bottom: 0,
    transformOrigin: 'left center',
  },
  sectionBlock: {
    marginTop: spacing.xs,
    overflow: 'visible',
  },
  sectionTitle: {
    ...typography.title3,
    marginBottom: spacing.xs,
  },
  horizontalList: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.page + spacing.sm,
    gap: spacing.md,
    overflow: 'visible',
  },
  edgeToEdge: {
    marginTop: -spacing.xs,
    marginBottom: -spacing.md,
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
