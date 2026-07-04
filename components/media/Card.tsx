import { useTracedRouter } from '@/hooks/performance/useTracedRouter';
import { useMediaActions } from '@/hooks/useMediaActions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { useAppTheme } from '@/lib/theme';
import { ImageUrlInfo } from '@/lib/utils/image';
import { MediaItem, MediaServerInfo } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Content, Item, ItemIcon, ItemTitle, Root as Menu, Trigger } from 'zeego/context-menu';

import { ItemImage } from '../ItemImage';
import { GlassCard, ShadowedGlassCard } from '../ui/GlassCard';
import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
  getSubtitle,
} from './cardHelpers';

export { getSubtitle } from './cardHelpers';

function EpisodeCardActionMenu({
  item,
  actionServer,
  children,
}: {
  item: MediaItem;
  actionServer?: MediaServerInfo;
  children: React.ReactNode;
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
    <Menu>
      <Trigger>{children}</Trigger>
      <Content>
        <Item key="play" onSelect={handlePlay}>
          <ItemIcon ios={{ name: 'play.circle' }} />
          <ItemTitle>播放</ItemTitle>
        </Item>
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
    </Menu>
  );
}

function SeriesCardActionMenu({
  item,
  actionServer,
  children,
  onViewDetails,
}: {
  item: MediaItem;
  actionServer?: MediaServerInfo;
  children: React.ReactNode;
  onViewDetails: () => void;
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
    <Menu>
      <Trigger>{children}</Trigger>
      <Content>
        <Item key="play" onSelect={handlePlay}>
          <ItemIcon ios={{ name: 'play.circle' }} />
          <ItemTitle>播放</ItemTitle>
        </Item>
        <Item key="viewDetails" onSelect={onViewDetails}>
          <ItemIcon ios={{ name: 'info.circle' }} />
          <ItemTitle>查看详情</ItemTitle>
        </Item>
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
    </Menu>
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
  const [isLongPressing, setIsLongPressing] = useState(false);

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

  const handlePress = useCallback(() => {
    if (isLongPressing) return;
    openDetails();
  }, [isLongPressing, openDetails]);

  const handlePlay = useCallback(() => {
    if (!item.id) return;
    router.push({
      pathname: '/player',
      params: { itemId: item.id },
    });
  }, [item.id, router]);

  const currentUserData = item.userData;
  const playedPercentage =
    typeof currentUserData?.playedPercentage === 'number'
      ? currentUserData.playedPercentage
      : undefined;

  const isPlayed = currentUserData?.played === true;
  const itemTitle = item.seriesName || item.name || '未知标题';

  const handleLongPressStart = useCallback(() => {
    setIsLongPressing(true);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    setTimeout(() => {
      setIsLongPressing(false);
    }, 10);
  }, []);

  const PlayButton = useCallback(() => {
    return (
      <GlassCard
        radius={9999}
        style={styles.playButton}
        fallbackBackgroundColor={theme.colors.mediaChrome}
        isInteractive
      >
        <Pressable style={styles.playButtonInner} onPress={handlePlay}>
          <Ionicons name="play" size={32} color="#fff" />
        </Pressable>
      </GlassCard>
    );
  }, [handlePlay, theme.colors.mediaChrome]);

  const CardComp = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开 ${itemTitle}`}
        style={[styles.card, { width: 200 }, style]}
        disabled={disabled}
        onPress={onPress || handlePress}
        onLongPress={handleLongPressStart}
        onPressOut={handleLongPressEnd}
      >
        <ShadowedGlassCard radius={12}>
          <View style={[styles.coverContainer, { backgroundColor: theme.colors.surfaceMuted }]}>
            <ItemImage
              uri={imageUrl}
              style={[
                styles.cover,
                { backgroundColor: theme.colors.surfaceMuted },
                showBorder && {
                  ...styles.cardBorder,
                  borderColor: theme.colors.separator,
                },
              ]}
              placeholderBlurhash={imageInfo.blurhash}
              cachePolicy="disk"
              contentFit="cover"
            />
            {showPlayButton && <PlayButton />}
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
            {playedPercentage !== undefined && (
              <View style={styles.progressContainer}>
                <View
                  style={[styles.progressBackground, { backgroundColor: theme.colors.mediaChrome }]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${playedPercentage}%`,
                        backgroundColor: accentColor,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
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
    ),
    [
      PlayButton,
      accentColor,
      disabled,
      handleLongPressEnd,
      handleLongPressStart,
      handlePress,
      hideText,
      imageInfo.blurhash,
      imageUrl,
      isPlayed,
      item,
      itemTitle,
      onPress,
      playedPercentage,
      showBorder,
      showPlayButton,
      style,
      theme,
    ],
  );

  return (
    <EpisodeCardActionMenu item={item} actionServer={actionServer}>
      <CardComp />
    </EpisodeCardActionMenu>
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
  const [isLongPressing, setIsLongPressing] = useState(false);

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

  const handlePress = useCallback(() => {
    if (isLongPressing) return;
    openDetails();
  }, [isLongPressing, openDetails]);

  const handleLongPressStart = useCallback(() => {
    setIsLongPressing(true);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    setTimeout(() => {
      setIsLongPressing(false);
    }, 10);
  }, []);

  const card = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开 ${itemTitle}`}
      style={[styles.card, { width: 120 }, style]}
      onPress={handlePress}
      onLongPress={handleLongPressStart}
      onPressOut={handleLongPressEnd}
    >
      <ShadowedGlassCard radius={12}>
        <ItemImage
          uri={imageUrl}
          style={[
            styles.posterCover,
            { backgroundColor: theme.colors.surfaceMuted },
            showBorder && {
              ...styles.cardBorder,
              borderColor: theme.colors.separator,
            },
          ]}
          placeholderBlurhash={imageInfo.blurhash}
          cachePolicy="disk"
          contentFit="cover"
        />
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
    <SeriesCardActionMenu item={item} actionServer={actionServer} onViewDetails={openDetails}>
      {card}
    </SeriesCardActionMenu>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
  },
  coverContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  cardBorder: {
    borderWidth: 0.5,
  },
  cover: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  posterCover: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 1,
  },
  progressBackground: {
    height: 4,
    borderRadius: 0,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
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
    zIndex: 3,
  },
  playButtonInner: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
