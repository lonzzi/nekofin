import { useThemeColor } from '@/hooks/useThemeColor';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { formatDurationFromTicks } from '@/lib/utils';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextLayoutEvent, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BottomSheetBackdropModal } from '../BottomSheetBackdropModal';
import { ThemedText } from '../ThemedText';

export const PlayButton = ({ item }: { item: MediaItem }) => {
  const router = useRouter();
  const { accentColor } = useAccentColor();
  const textColor = useThemeColor({ light: '#fff', dark: '#fff' }, 'text');

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
      <TouchableOpacity
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
      </TouchableOpacity>
    </GlassView>
  );
};

export const ItemMeta = ({ item }: { item: MediaItem }) => {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');

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
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [textLines, setTextLines] = useState(0);

  const { accentColor } = useAccentColor();

  const overview = item?.overview?.trim() ?? '';

  const handleShowMore = () => {
    bottomSheetModalRef.current?.present();
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
          <TouchableOpacity onPress={handleShowMore}>
            <Text style={[detailViewStyles.overview, { color: accentColor }]}>查看更多</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheetBackdropModal ref={bottomSheetModalRef} enableDynamicSizing>
        <BottomSheetView style={detailViewStyles.modalContent}>
          <Text style={[detailViewStyles.modalTitle, { color: textColor }]}>剧情简介</Text>
          <Text style={[detailViewStyles.modalOverview, { color: textColor }]}>{overview}</Text>
        </BottomSheetView>
      </BottomSheetBackdropModal>
    </>
  );
};

export const ItemInfoList = ({ item }: { item: MediaItem }) => {
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');

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
    backgroundColor: '#eee',
  },
  content: {
    top: -140,
    padding: 20,
    gap: 8,
    marginBottom: -60,
  },
  logo: {
    width: '100%',
    height: 120,
  },
  meta: {
    fontSize: 14,
  },
  star: {
    color: '#F5C518',
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
  },
  overviewContainer: {
    gap: 8,
    marginBottom: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverview: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoBlock: {
    marginTop: 6,
    rowGap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  infoLabel: {
    fontSize: 14,
    width: 56,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  playButton: {
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  playButtonProgressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sectionBlock: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  horizontalList: {
    paddingVertical: 4,
    paddingHorizontal: 20,
    gap: 12,
  },
  edgeToEdge: {
    marginHorizontal: -20,
  },
  horizontalCard: {
    width: 200,
  },
  listContainer: {
    marginTop: 16,
    rowGap: 16,
  },
  listItem: {
    width: '100%',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.6,
  },
  lastLineContainer: {
    marginTop: -8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
});
