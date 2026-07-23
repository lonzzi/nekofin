import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaActions } from '@/hooks/useMediaActions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { useAppTheme } from '@/lib/theme';
import { ImageUrlInfo } from '@/lib/utils/image';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { BlurView } from 'expo-blur';
import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Content, Item, ItemIcon, ItemTitle, Root as Menu, Trigger } from 'zeego/context-menu';

import { ItemImage } from '../ItemImage';
import { CoverFrame } from '../ui/CoverFrame';
import { ShadowedGlassCard } from '../ui/GlassCard';
import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
  getSubtitle,
} from './cardHelpers';

export { getSubtitle } from './cardHelpers';

const CARD_CONTEXT_MENU_IOS_PROPS = {
  shouldPreventLongPressGestureFromPropagating: false,
} as const;

type CardActionMenuRootProps = React.ComponentProps<typeof Menu> & {
  __unsafeIosProps?: typeof CARD_CONTEXT_MENU_IOS_PROPS;
};

const CardActionMenuRoot = Menu as React.ComponentType<CardActionMenuRootProps>;

function CardActionMenu({
  item,
  actionServer,
  children,
  onViewDetails,
}: {
  item: MediaItem;
  actionServer?: MediaServerInfo;
  children: React.ReactNode;
  onViewDetails?: () => void;
}) {
  const {
    currentUserData,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  } = useMediaActions(item, actionServer);
  const isPlayed = currentUserData?.played === true;

  return (
    <CardActionMenuRoot __unsafeIosProps={CARD_CONTEXT_MENU_IOS_PROPS}>
      <Trigger>{children}</Trigger>
      <Content>
        <Item key="play" onSelect={handlePlay}>
          <ItemIcon ios={{ name: 'play.circle' }} />
          <ItemTitle>播放</ItemTitle>
        </Item>
        {onViewDetails && (
          <Item key="viewDetails" onSelect={onViewDetails}>
            <ItemIcon ios={{ name: 'info.circle' }} />
            <ItemTitle>查看详情</ItemTitle>
          </Item>
        )}
        <Item key="addToFavorites" onSelect={handleAddToFavorites}>
          <ItemIcon ios={{ name: 'heart' }} />
          <ItemTitle>添加到收藏</ItemTitle>
        </Item>
        <Item
          key={isPlayed ? 'markAsUnwatched' : 'markAsWatched'}
          onSelect={isPlayed ? handleMarkAsUnwatched : handleMarkAsWatched}
        >
          <ItemIcon ios={{ name: isPlayed ? 'eye.slash' : 'eye' }} />
          <ItemTitle>{isPlayed ? '标记为未看' : '标记为已看'}</ItemTitle>
        </Item>
      </Content>
    </CardActionMenuRoot>
  );
}

export const EpisodeCard = React.memo(function EpisodeCard({
  item,
  style,
  hideText,
  imgType = 'Thumb',
  imgInfo,
  onPress,
  disabled = false,
  showPlayButton = false,
  showBorder = false,
  actionServer,
}: {
  item: MediaItem;
  style?: StyleProp<ViewStyle>;
  hideText?: boolean;
  imgType?: ImageType;
  imgInfo?: ImageUrlInfo;
  onPress?: () => void;
  disabled?: boolean;
  showPlayButton?: boolean;
  showBorder?: boolean;
  actionServer?: MediaServerInfo;
}) {
  const router = useTracedRouter('episode-card');
  const theme = useAppTheme();
  const { accentColor } = useAccentColor();

  const mediaAdapter = useMediaAdapter();

  const imageInfo = useMemo(
    () =>
      imgInfo ??
      mediaAdapter.getImageInfo({
        item,
        opts: getImagePreferenceOptions(imgType),
      }),
    [imgInfo, mediaAdapter, item, imgType],
  );

  const imageUrl = imageInfo.url;

  const openDetails = useCallback(() => {
    const route = getEpisodeCardRoute(item);
    if (route) router.push(route);
  }, [item, router]);

  const handlePlay = useCallback(() => {
    if (!item.id) return;
    router.push({
      pathname: '/player',
      params: { itemId: item.id },
    });
  }, [item.id, router]);

  const currentUserData = item.userData;
  const rawPlayedPercentage = currentUserData?.playedPercentage;
  const playedPercentage =
    typeof rawPlayedPercentage === 'number' && Number.isFinite(rawPlayedPercentage)
      ? Math.max(0, Math.min(100, rawPlayedPercentage))
      : undefined;

  const isPlayed = currentUserData?.played === true;
  const itemTitle = item.seriesName || item.name || '未知标题';

  return (
    <CardActionMenu item={item} actionServer={actionServer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开 ${itemTitle}`}
        style={[styles.card, { width: 200 }, style]}
        disabled={disabled}
        onPress={onPress || openDetails}
      >
        <ShadowedGlassCard radius={12} surface="transparent">
          <CoverFrame aspectRatio={16 / 9} emphasized={showBorder} radius={14}>
            <ItemImage
              uri={imageUrl}
              style={[styles.cover, { backgroundColor: theme.colors.surfaceMuted }]}
              placeholderBlurhash={imageInfo.blurhash}
              cachePolicy="disk"
              contentFit="cover"
            />
            {showPlayButton && (
              <BlurView
                intensity={36}
                tint="systemUltraThinMaterialDark"
                blurMethod="dimezisBlurViewSdk31Plus"
                blurReductionFactor={2}
                style={styles.playButton}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.playButtonInner,
                    pressed && styles.playButtonPressed,
                  ]}
                  onPress={handlePlay}
                >
                  <Ionicons name="play" size={27} color="#fff" />
                </Pressable>
              </BlurView>
            )}
            {isPlayed && (
              <View
                style={[
                  styles.playedOverlay,
                  {
                    backgroundColor: theme.colors.mediaChrome,
                    borderRadius: theme.radius.pill,
                    padding: theme.spacing.xxs,
                    right: theme.spacing.sm,
                    top: theme.spacing.sm,
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={24} color={accentColor} />
              </View>
            )}
            {playedPercentage !== undefined && playedPercentage > 0 && playedPercentage < 100 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${playedPercentage}%` }]} />
              </View>
            )}
          </CoverFrame>
          {!hideText && (
            <View style={styles.cardCopy}>
              <Text
                style={[
                  theme.typography.bodyEmphasized,
                  styles.cardTitle,
                  { color: theme.colors.text },
                ]}
                numberOfLines={1}
              >
                {item.seriesName || item.name || '未知标题'}
              </Text>
              <Text
                style={[
                  theme.typography.footnote,
                  styles.subtitle,
                  { color: theme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {getSubtitle(item)}
              </Text>
            </View>
          )}
        </ShadowedGlassCard>
      </Pressable>
    </CardActionMenu>
  );
});

export const SeriesCard = React.memo(function SeriesCard({
  item,
  style,
  imgType = 'Primary',
  imgInfo,
  hideSubtitle = false,
  showBorder = false,
  onPress,
  actionServer,
}: {
  item: MediaItem;
  style?: StyleProp<ViewStyle>;
  imgType?: ImageType;
  imgInfo?: ImageUrlInfo;
  hideSubtitle?: boolean;
  showBorder?: boolean;
  onPress?: () => void;
  actionServer?: MediaServerInfo;
}) {
  const theme = useAppTheme();
  const router = useTracedRouter('series-card');

  const mediaAdapter = useMediaAdapter();

  const imageInfo = useMemo(
    () =>
      imgInfo ??
      mediaAdapter.getImageInfo({
        item,
        opts: getImagePreferenceOptions(imgType),
      }),
    [imgInfo, mediaAdapter, item, imgType],
  );

  const imageUrl = imageInfo.url;
  const itemTitle = item.seriesName || item.name || '未知标题';

  const openDetails = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }

    const route = getSeriesCardRoute(item);
    if (route) {
      router.push(route);
    } else {
      console.warn('Unknown type:', item.type);
    }
  }, [item, onPress, router]);

  const card = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开 ${itemTitle}`}
      style={[styles.card, { width: 120 }, style]}
      onPress={openDetails}
    >
      <ShadowedGlassCard radius={12} surface="transparent">
        <CoverFrame aspectRatio={2 / 3} emphasized={showBorder} radius={14}>
          <ItemImage
            uri={imageUrl}
            style={[styles.posterCover, { backgroundColor: theme.colors.surfaceMuted }]}
            placeholderBlurhash={imageInfo.blurhash}
            cachePolicy="disk"
            contentFit="cover"
          />
        </CoverFrame>
        <View style={styles.cardCopy}>
          <Text
            style={[
              theme.typography.bodyEmphasized,
              styles.cardTitle,
              { color: theme.colors.text },
            ]}
            numberOfLines={1}
          >
            {hideSubtitle ? item.name : item.seriesName || item.name || '未知标题'}
          </Text>
          {!hideSubtitle && (
            <Text
              style={[
                theme.typography.footnote,
                styles.subtitle,
                { color: theme.colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {getSubtitle(item)}
            </Text>
          )}
        </View>
      </ShadowedGlassCard>
    </Pressable>
  );

  return (
    <CardActionMenu item={item} actionServer={actionServer} onViewDetails={openDetails}>
      {card}
    </CardActionMenu>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  posterCover: {
    width: '100%',
    height: '100%',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    zIndex: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  playedOverlay: {
    position: 'absolute',
    zIndex: 2,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    width: 48,
    height: 48,
    borderRadius: 999,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(20,20,20,0.16)',
    overflow: 'hidden',
    zIndex: 3,
  },
  playButtonInner: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cardCopy: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
