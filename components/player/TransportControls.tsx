import { IconSymbol } from '@/components/ui/IconSymbol';
import * as Haptics from 'expo-haptics';
import { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePlayer } from './PlayerContext';
import { getNormalizedSeekPosition, PLAYER_SEEK_INTERVAL_MS } from './playerControlModel';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import { useOverlayInsets } from './useOverlayInsets';

export function TransportControls() {
  const { isCompact } = useOverlayInsets();
  const {
    currentTime,
    duration,
    fadeAnim,
    hasNextEpisode,
    hasPreviousEpisode,
    hideControlsWithDelay,
    isMovie,
    isLoading,
    isPlaying,
    onNextEpisode,
    onPlayPause,
    onPreviousEpisode,
    onSeek,
    showControls,
  } = usePlayer();

  const seekBy = useCallback(
    (offset: number) => {
      const position = getNormalizedSeekPosition({
        currentTimeMs: currentTime.get(),
        durationMs: duration,
        offsetMs: offset,
      });
      if (position == null) return;
      onSeek(position);
      void Haptics.selectionAsync();
      hideControlsWithDelay();
    },
    [currentTime, duration, hideControlsWithDelay, onSeek],
  );

  const handlePlayPause = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPause();
    hideControlsWithDelay();
  }, [hideControlsWithDelay, onPlayPause]);

  const handleEpisodeChange = useCallback(
    (direction: 'previous' | 'next') => {
      void Haptics.selectionAsync();
      if (direction === 'previous') {
        onPreviousEpisode?.();
      } else {
        onNextEpisode?.();
      }
      hideControlsWithDelay();
    },
    [hideControlsWithDelay, onNextEpisode, onPreviousEpisode],
  );

  const canSeek = duration > 0;
  const groupHeight = isCompact ? 44 : 48;
  const sideButtonWidth = isCompact ? 44 : 46;
  const playButtonWidth = isCompact ? 52 : 56;
  const coreGroupWidth = sideButtonWidth * 2 + playButtonWidth;
  const episodeGroupWidth = sideButtonWidth * 2;

  // The player owns a richer buffering overlay with progress and transfer rate,
  // so the bottom transport bar stays out of the way while loading.
  if (isLoading) return null;

  return (
    <View pointerEvents={showControls ? 'box-none' : 'none'} style={styles.container}>
      <View style={styles.cluster}>
        <PlayerGlassSurface
          contentStyle={styles.surfaceContent}
          fadeProgress={fadeAnim}
          fallbackBackgroundColor="rgba(13,15,19,0.64)"
          isInteractive={false}
          radius={groupHeight / 2}
          style={{ height: groupHeight, width: coreGroupWidth }}
          surfaceStyle={styles.surfaceFill}
          tintColor="rgba(8,10,14,0.2)"
          visible={showControls}
        >
          <View style={styles.group}>
            <TransportButton
              disabled={!canSeek}
              icon={
                <IconSymbol
                  name="gobackward.10"
                  size={isCompact ? 21 : 23}
                  color="#fff"
                  weight="medium"
                />
              }
              height={groupHeight}
              label="后退 10 秒"
              onPress={() => seekBy(-PLAYER_SEEK_INTERVAL_MS)}
              width={sideButtonWidth}
            />
            <TransportButton
              emphasized
              disabled={false}
              icon={
                <IconSymbol
                  name={isPlaying ? 'pause.fill' : 'play.fill'}
                  size={isCompact ? 25 : 27}
                  color="#fff"
                  style={!isPlaying && styles.playIcon}
                  weight="semibold"
                />
              }
              height={groupHeight}
              label={isPlaying ? '暂停' : '播放'}
              onPress={handlePlayPause}
              width={playButtonWidth}
            />
            <TransportButton
              disabled={!canSeek}
              icon={
                <IconSymbol
                  name="goforward.10"
                  size={isCompact ? 21 : 23}
                  color="#fff"
                  weight="medium"
                />
              }
              height={groupHeight}
              label="前进 10 秒"
              onPress={() => seekBy(PLAYER_SEEK_INTERVAL_MS)}
              width={sideButtonWidth}
            />
          </View>
        </PlayerGlassSurface>

        {!isMovie && (
          <PlayerGlassSurface
            contentStyle={styles.surfaceContent}
            fadeProgress={fadeAnim}
            fallbackBackgroundColor="rgba(13,15,19,0.56)"
            isInteractive={false}
            radius={groupHeight / 2}
            style={{ height: groupHeight, width: episodeGroupWidth }}
            surfaceStyle={styles.surfaceFill}
            tintColor="rgba(8,10,14,0.12)"
            visible={showControls}
          >
            <View style={styles.group}>
              <TransportButton
                disabled={!hasPreviousEpisode}
                icon={
                  <IconSymbol
                    name="backward.end.fill"
                    size={isCompact ? 17 : 19}
                    color="rgba(255,255,255,0.76)"
                    weight="medium"
                  />
                }
                height={groupHeight}
                label="上一集"
                onPress={() => handleEpisodeChange('previous')}
                width={sideButtonWidth}
              />
              <TransportButton
                disabled={!hasNextEpisode}
                icon={
                  <IconSymbol
                    name="forward.end.fill"
                    size={isCompact ? 17 : 19}
                    color="rgba(255,255,255,0.76)"
                    weight="medium"
                  />
                }
                height={groupHeight}
                label="下一集"
                onPress={() => handleEpisodeChange('next')}
                width={sideButtonWidth}
              />
            </View>
          </PlayerGlassSurface>
        )}
      </View>
    </View>
  );
}

function TransportButton({
  disabled,
  emphasized = false,
  height,
  icon,
  label,
  onPress,
  width,
}: {
  disabled: boolean;
  emphasized?: boolean;
  height: number;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.transportButton,
        { borderRadius: height / 2, height, width },
        pressed && styles.pressed,
        pressed && emphasized && styles.emphasizedPressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    justifyContent: 'center',
  },
  cluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  group: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
  },
  transportButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    justifyContent: 'center',
  },
  surfaceFill: {
    flex: 1,
  },
  surfaceContent: {
    height: '100%',
  },
  playIcon: {
    transform: [{ translateX: 1 }],
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.82,
  },
  emphasizedPressed: {
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.34,
  },
});
