import { useCurrentTime } from '@/hooks/useCurrentTime';
import { formatTimeWorklet } from '@/lib/utils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer } from './PlayerContext';
import { SettingsButtons } from './SettingsButtons';
import { useOverlayInsets } from './useOverlayInsets';

export function BottomControls() {
  const { side, bottomExtra } = useOverlayInsets();
  const insets = useSafeAreaInsets();

  const {
    isPlaying,
    isLoading,
    duration,
    currentTime,
    onSeek,
    onPlayPause,
    hasPreviousEpisode,
    hasNextEpisode,
    onPreviousEpisode,
    onNextEpisode,
    showControls,
    fadeAnim,
    isDragging,
    setIsDragging,
    hideControlsWithDelay,
    episodes,
    isMovie,
    episodeListDrawerRef,
  } = usePlayer();
  const currentTimeMs = useCurrentTime({ time: currentTime });

  const fadeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  const progressValue = useSharedValue(0);
  const minimumValue = useSharedValue(0);
  const maximumValue = useSharedValue(1);

  useDerivedValue(() => {
    if (!isDragging && duration > 0) {
      // currentTime.value and duration are both in milliseconds
      const progress = currentTime.value / duration;
      progressValue.value = progress;
    }
  });

  const handleSeek = useCallback(
    (position: number) => {
      if (!duration) return;
      const clampedTime = Math.max(0, Math.min(position, duration));
      const newPosition = duration > 0 ? clampedTime / duration : 0;
      onSeek(newPosition);
    },
    [duration, onSeek],
  );

  const handleSliderChange = (value: number) => {
    if (!duration) return;
    progressValue.value = value;
  };

  const handleSliderSlidingStart = () => {
    setIsDragging(true);
  };

  const handleSliderSlidingComplete = (value: number) => {
    if (!duration) return;
    const newTime = value * duration;
    handleSeek(newTime);
    progressValue.value = value;
    setIsDragging(false);
    hideControlsWithDelay();
  };

  const handlePlayPause = async () => {
    onPlayPause();
  };

  const handleEpisodeListPress = () => {
    if (!isMovie && episodes.length > 0) {
      episodeListDrawerRef.current?.present();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { left: side, right: side, bottom: insets.bottom + 10 + bottomExtra },
        fadeAnimatedStyle,
      ]}
      pointerEvents={showControls ? 'auto' : 'none'}
    >
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.timeText}>{formatTimeWorklet(currentTimeMs)}</Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              containerStyle={{ overflow: 'hidden', borderRadius: 999 }}
              progress={progressValue}
              bubble={(percent) => formatTimeWorklet(percent * duration)}
              bubbleTextStyle={{ fontFamily: 'Roboto' }}
              minimumValue={minimumValue}
              maximumValue={maximumValue}
              onValueChange={handleSliderChange}
              onSlidingStart={handleSliderSlidingStart}
              onSlidingComplete={handleSliderSlidingComplete}
              theme={{
                minimumTrackTintColor: '#fff',
                maximumTrackTintColor: 'rgba(255,255,255,0.3)',
              }}
              disableTapEvent={false}
            />
          </View>
          <Text style={styles.timeText}>{formatTimeWorklet(duration)}</Text>
        </View>
        <View style={styles.progressOverlayRight}>
          <SettingsButtons />
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.cornerButton}>
          {/* <Ionicons name="lock-closed-outline" size={24} color="#fff" /> */}
        </View>

        <View style={styles.controlsCluster}>
          <Pressable
            style={[styles.circleButton, !hasPreviousEpisode && styles.disabledButton]}
            onPress={hasPreviousEpisode ? onPreviousEpisode : undefined}
            disabled={!hasPreviousEpisode}
          >
            <Ionicons
              name="play-skip-back"
              size={24}
              color={hasPreviousEpisode ? 'white' : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>

          <Pressable style={styles.playButton} onPress={handlePlayPause}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="white" />
            )}
          </Pressable>

          <Pressable
            style={[styles.circleButton, !hasNextEpisode && styles.disabledButton]}
            onPress={hasNextEpisode ? onNextEpisode : undefined}
            disabled={!hasNextEpisode}
          >
            <Ionicons
              name="play-skip-forward"
              size={24}
              color={hasNextEpisode ? 'white' : 'rgba(255,255,255,0.3)'}
            />
          </Pressable>
        </View>

        <Pressable
          style={[styles.cornerButton, (isMovie || episodes.length === 0) && styles.disabledButton]}
          onPress={handleEpisodeListPress}
          disabled={isMovie || episodes.length === 0}
        >
          <Ionicons
            name="list"
            size={24}
            color={isMovie || episodes.length === 0 ? 'rgba(255,255,255,0.3)' : '#fff'}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
    gap: 8,
  },
  progressSection: {
    position: 'relative',
    paddingTop: 30,
  },
  playButton: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressOverlayRight: {
    position: 'absolute',
    right: 0,
    bottom: 30,
  },
  sliderContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 30,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  cornerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
});
