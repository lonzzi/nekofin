import { useMediaActions } from '@/hooks/useMediaActions';
import { useMediaAdapter } from '@/hooks/useMediaAdapter';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAccentColor } from '@/lib/contexts/ThemeColorContext';
import { ImageUrlInfo } from '@/lib/utils/image';
import { MediaItem } from '@/services/media/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Content, Item, ItemIcon, ItemTitle, Root as Menu, Trigger } from 'zeego/context-menu';

import { ItemImage } from '../ItemImage';
import {
  getEpisodeCardRoute,
  getImagePreferenceOptions,
  getSeriesCardRoute,
  getSubtitle,
} from './cardHelpers';

export { getSubtitle } from './cardHelpers';

export const EpisodeCard = React.memo(function EpisodeCard({
  item,
  style,
  hideText,
  imgType = 'Thumb',
  imgInfo,
  onPress,
  disabled = false,
  showPlayButton = false,
  showBorder = true,
  disableContextMenu = false,
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
  disableContextMenu?: boolean;
}) {
  const router = useRouter();
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#333' }, 'background');
  const { accentColor } = useAccentColor();
  const [isLongPressing, setIsLongPressing] = useState(false);

  const mediaAdapter = useMediaAdapter();
  const {
    currentUserData,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  } = useMediaActions(item);

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

  const handlePress = useCallback(async () => {
    if (isLongPressing) return;

    const route = getEpisodeCardRoute(item);
    if (route) router.push(route);
  }, [item, isLongPressing, router]);

  const playedPercentage =
    typeof currentUserData?.playedPercentage === 'number'
      ? currentUserData.playedPercentage
      : undefined;

  const isPlayed = currentUserData?.played === true;

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
      <Pressable
        style={[
          styles.playButton,
          !isLiquidGlassAvailable() && { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
        ]}
        onPress={handlePlay}
      >
        <Ionicons name="play" size={32} color="#fff" />
      </Pressable>
    );
  }, [handlePlay]);

  const CardComp = useCallback(
    () => (
      <Pressable
        style={[styles.card, { width: 200 }, style]}
        disabled={disabled}
        onPress={onPress || handlePress}
        onLongPress={handleLongPressStart}
        onPressOut={handleLongPressEnd}
      >
        <View style={styles.coverContainer}>
          <ItemImage
            uri={imageUrl}
            style={[styles.cover, showBorder && { ...styles.cardBorder, borderColor }]}
            placeholderBlurhash={imageInfo.blurhash}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
          {showPlayButton &&
            (isLiquidGlassAvailable() ? (
              <GlassView style={styles.playButton} glassEffectStyle="clear" isInteractive>
                <PlayButton />
              </GlassView>
            ) : (
              <PlayButton />
            ))}
          {isPlayed && (
            <View style={styles.playedOverlay}>
              <Ionicons name="checkmark-circle" size={24} color={accentColor} />
            </View>
          )}
          {playedPercentage !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
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
          <>
            <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
              {item.seriesName || item.name || '未知标题'}
            </Text>
            <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
              {getSubtitle(item)}
            </Text>
          </>
        )}
      </Pressable>
    ),
    [
      PlayButton,
      accentColor,
      borderColor,
      disabled,
      handleLongPressEnd,
      handleLongPressStart,
      handlePress,
      hideText,
      imageInfo.blurhash,
      imageUrl,
      isPlayed,
      item,
      onPress,
      playedPercentage,
      showBorder,
      showPlayButton,
      style,
      subtitleColor,
      textColor,
    ],
  );

  if (disableContextMenu) {
    return <CardComp />;
  }

  return (
    <Menu>
      <Trigger>
        <CardComp />
      </Trigger>
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
});

export const SeriesCard = React.memo(function SeriesCard({
  item,
  style,
  imgType = 'Primary',
  hideSubtitle = false,
  showBorder = true,
}: {
  item: MediaItem;
  style?: StyleProp<ViewStyle>;
  imgType?: ImageType;
  hideSubtitle?: boolean;
  showBorder?: boolean;
}) {
  const textColor = useThemeColor({ light: '#000', dark: '#fff' }, 'text');
  const subtitleColor = useThemeColor({ light: '#666', dark: '#999' }, 'text');
  const borderColor = useThemeColor({ light: '#ccc', dark: '#333' }, 'background');
  const router = useRouter();
  const [isLongPressing, setIsLongPressing] = useState(false);

  const mediaAdapter = useMediaAdapter();
  const {
    currentUserData,
    handlePlay,
    handleAddToFavorites,
    handleMarkAsWatched,
    handleMarkAsUnwatched,
  } = useMediaActions(item);

  const imageInfo = useMemo(
    () =>
      mediaAdapter.getImageInfo({
        item,
        opts: getImagePreferenceOptions(imgType),
      }),
    [mediaAdapter, item, imgType],
  );

  const imageUrl = imageInfo.url;

  const handlePress = useCallback(() => {
    if (isLongPressing) return;

    const route = getSeriesCardRoute(item);
    if (route) {
      router.push(route);
    } else {
      console.warn('Unknown type:', item.type);
    }
  }, [isLongPressing, item, router]);

  const isPlayed = currentUserData?.played === true;

  const handleLongPressStart = useCallback(() => {
    setIsLongPressing(true);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    setTimeout(() => {
      setIsLongPressing(false);
    }, 10);
  }, []);

  return (
    <Menu>
      <Trigger>
        <Pressable
          style={[styles.card, { width: 120 }, style]}
          onPress={handlePress}
          onLongPress={handleLongPressStart}
          onPressOut={handleLongPressEnd}
        >
          <ItemImage
            uri={imageUrl}
            style={[styles.posterCover, showBorder && { ...styles.cardBorder, borderColor }]}
            placeholderBlurhash={imageInfo.blurhash}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
          <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
            {hideSubtitle ? item.name : item.seriesName || item.name || '未知标题'}
          </Text>
          {!hideSubtitle && (
            <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
              {getSubtitle(item)}
            </Text>
          )}
        </Pressable>
      </Trigger>
      <Content>
        <Item key="play" onSelect={handlePlay}>
          <ItemIcon ios={{ name: 'play.circle' }} />
          <ItemTitle>播放</ItemTitle>
        </Item>
        <Item key="viewDetails" onSelect={handlePress}>
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
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  coverContainer: {
    position: 'relative',
    backgroundColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBorder: {
    borderWidth: 0.5,
    borderColor: '#ccc',
    borderRadius: 12,
  },
  cover: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  posterCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#eee',
    borderRadius: 12,
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
    backgroundColor: 'rgba(51, 51, 51, 0.8)',
    borderRadius: 0,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
  },
  playedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 9999,
    padding: 2,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    width: 48,
    height: 48,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginHorizontal: 8,
  },
  subtitle: {
    fontSize: 13,
    marginHorizontal: 8,
    marginTop: 2,
  },
});
