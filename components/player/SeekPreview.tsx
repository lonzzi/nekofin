import { useMediaServers } from '@/lib/contexts/MediaServerContext';
import { formatTimeWorklet } from '@/lib/utils';
import { createEmbyApiClient } from '@/services/media/emby/client';
import {
  getEmbyThumbnail,
  getEmbyThumbnailSet,
  getEmbyThumbnailUrl,
} from '@/services/media/emby/thumbnails';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  setNativeProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { formatSeekOffsetText } from './gestureMath';
import { usePlayer } from './PlayerContext';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import { getTrickplayFrame, getTrickplayManifest, getTrickplayTileUrl } from './trickplay';

export function SeekPreview() {
  const {
    isDragging,
    isGestureSeekingActive,
    seekPreviewTime,
    seekPreviewStartTime,
    duration,
    currentItem,
    selectedMediaSourceId,
    isPanelOpen,
  } = usePlayer();
  const { currentApi, currentServer } = useMediaServers();
  const info = useMemo(
    () =>
      currentServer?.type === 'jellyfin'
        ? getTrickplayManifest(currentItem?.raw, selectedMediaSourceId)
        : null,
    [currentServer?.type, currentItem?.raw, selectedMediaSourceId],
  );
  const { data: embyThumbnails } = useQuery({
    queryKey: [
      'player-preview',
      currentServer?.id,
      currentServer?.userId,
      currentApi?.basePath,
      currentItem?.id,
      selectedMediaSourceId,
    ],
    enabled: currentServer?.type === 'emby' && !!currentApi && !!currentItem?.id,
    queryFn: ({ signal }) =>
      getEmbyThumbnailSet(
        createEmbyApiClient(currentApi!),
        currentItem!.id,
        selectedMediaSourceId,
        signal,
      ),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const materialOpacity = useSharedValue(1);
  const timeRef = useAnimatedRef<TextInput>();
  const detailRef = useAnimatedRef<TextInput>();
  const [preview, setPreview] = useState({ active: false, index: 0 });
  const [failedTile, setFailedTile] = useState<string | null>(null);
  const active = useDerivedValue(
    () => !isPanelOpen && (isDragging || isGestureSeekingActive.value),
  );
  const fade = useDerivedValue<number>(() => withTiming(active.value ? 1 : 0, { duration: 140 }));
  useAnimatedReaction(
    () => ({
      active: active.value,
      index: info
        ? Math.floor(seekPreviewTime.value / info.Interval)
        : embyThumbnails
          ? Math.floor(seekPreviewTime.value / 250)
          : 0,
    }),
    (next, previous) => {
      if (next.active !== previous?.active || (next.active && next.index !== previous?.index)) {
        scheduleOnRN(setPreview, next);
      }
    },
  );
  useAnimatedReaction(
    () => seekPreviewTime.value,
    (time) => {
      setNativeProps(timeRef, {
        text: `${formatTimeWorklet(time)} / ${formatTimeWorklet(duration)}`,
      });
      setNativeProps(detailRef, {
        text: formatSeekOffsetText(time - seekPreviewStartTime.value),
      });
    },
  );
  const previewStyle = useAnimatedStyle(() => ({
    // Hide on release before React removes the thumbnail and changes the layout.
    opacity: active.value ? fade.value : 0,
  }));
  const frame = info ? getTrickplayFrame(info, preview.index * info.Interval) : null;
  const embyFrame = embyThumbnails ? getEmbyThumbnail(embyThumbnails, preview.index * 250) : null;
  const uri =
    preview.active && currentApi && currentItem
      ? info && frame
        ? getTrickplayTileUrl(currentApi.basePath, currentItem.id, info, frame.tileIndex)
        : embyFrame
          ? getEmbyThumbnailUrl(
              currentApi.basePath,
              currentItem.id,
              embyFrame,
              selectedMediaSourceId,
            )
          : null
      : null;
  const showImage = uri && uri !== failedTile;
  const aspectRatio = info ? info.Width / info.Height : (embyThumbnails?.AspectRatio ?? 16 / 9);
  const width = Math.min(176, 112 * aspectRatio);
  const height = width / aspectRatio;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, Platform.OS === 'android' && styles.androidContainer, previewStyle]}
    >
      {Platform.OS === 'android' ? (
        <PlayerGlassSurface
          fadeProgress={materialOpacity}
          visible={preview.active}
          isInteractive={false}
          pointerEvents="none"
          radius={20}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {showImage && (
        <View style={[styles.thumbnail, { width, height }]}>
          <Image
            source={{
              uri,
              headers: currentApi?.accessToken
                ? { 'X-Emby-Token': currentApi.accessToken }
                : undefined,
            }}
            cachePolicy="memory"
            recyclingKey={uri}
            contentFit="fill"
            transition={0}
            onError={() => setFailedTile(uri)}
            style={{
              position: 'absolute',
              width: width * (info?.TileWidth ?? 1),
              height: height * (info?.TileHeight ?? 1),
              left: -(frame?.column ?? 0) * width,
              top: -(frame?.row ?? 0) * height,
            }}
          />
        </View>
      )}
      <TextInput
        accessible={false}
        caretHidden
        editable={false}
        defaultValue="0:00 / 0:00"
        ref={timeRef}
        style={[styles.time, styles.textShadow]}
        underlineColorAndroid="transparent"
      />
      <TextInput
        accessible={false}
        caretHidden
        editable={false}
        defaultValue=""
        ref={detailRef}
        style={[styles.detail, styles.textShadow]}
        underlineColorAndroid="transparent"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    zIndex: 20,
    width: 240,
    gap: 4,
    alignItems: 'center',
  },
  androidContainer: { paddingVertical: 12, overflow: 'hidden', borderRadius: 20 },
  thumbnail: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)' },
  time: {
    width: 208,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  detail: {
    width: 176,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    padding: 0,
    textAlign: 'center',
  },
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
