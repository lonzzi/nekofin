import { useCurrentTime } from '@/hooks/useCurrentTime';
import { formatTimeWorklet } from '@/lib/utils';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { usePlayer } from './PlayerContext';
import { SettingsButtons } from './SettingsButtons';
import { useOverlayInsets } from './useOverlayInsets';

export function BottomControls() {
  const { side, bottomExtra } = useOverlayInsets();
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

  return (
    <Animated.View
      style={[
        styles.container,
        { left: side, right: side, bottom: 30 + bottomExtra },
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
        <TouchableOpacity style={styles.cornerButton}>
          <MaterialCommunityIcons name="lock-outline" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={styles.controlsCluster}>
          <TouchableOpacity
            style={[styles.circleButton, !hasPreviousEpisode && styles.disabledButton]}
            onPress={hasPreviousEpisode ? onPreviousEpisode : undefined}
            disabled={!hasPreviousEpisode}
          >
            <Entypo
              name="controller-jump-to-start"
              size={20}
              color={hasPreviousEpisode ? 'white' : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Entypo
                name={isPlaying ? 'controller-paus' : 'controller-play'}
                size={28}
                color="white"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.circleButton, !hasNextEpisode && styles.disabledButton]}
            onPress={hasNextEpisode ? onNextEpisode : undefined}
            disabled={!hasNextEpisode}
          >
            <Entypo
              name="controller-next"
              size={20}
              color={hasNextEpisode ? 'white' : 'rgba(255,255,255,0.3)'}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cornerButton}>
          <MaterialCommunityIcons name="playlist-play" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    zIndex: 10,
    gap: 10,
  },
  progressSection: {
    position: 'relative',
    paddingTop: 50,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    top: 0,
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
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
  settingsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cornerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
