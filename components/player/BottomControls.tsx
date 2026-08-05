import { useCurrentTime } from '@/hooks/useCurrentTime';
import { formatTimeWorklet } from '@/lib/utils';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayerActionBar } from './PlayerActionBar';
import { usePlayer } from './PlayerContext';
import { PlayerProgressSlider } from './PlayerProgressSlider';
import { TransportControls } from './TransportControls';
import { useOverlayInsets } from './useOverlayInsets';

export function BottomControls() {
  const { side, bottomExtra, maxContentWidth, stackBottomControls } = useOverlayInsets();
  const insets = useSafeAreaInsets();
  const {
    bufferedProgress,
    currentTime,
    duration,
    fadeAnim,
    hideControlsWithDelay,
    isDragging,
    isLoading,
    onSeek,
    setIsDragging,
    showControls,
  } = usePlayer();
  const currentTimeMs = useCurrentTime({ time: currentTime });

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));
  const progressValue = useSharedValue(0);

  useDerivedValue(() => {
    if (!isDragging && duration > 0) {
      progressValue.set(currentTime.get() / duration);
    }
  });

  const seekToTime = useCallback(
    (time: number) => {
      if (duration <= 0) return;
      const clampedTime = Math.max(0, Math.min(time, duration));
      onSeek(clampedTime / duration);
    },
    [duration, onSeek],
  );

  const handleSliderSlidingComplete = (value: number) => {
    progressValue.set(value);
    if (duration > 0) {
      seekToTime(value * duration);
    }
    setIsDragging(false);
    hideControlsWithDelay();
  };

  const formattedCurrentTime = formatTimeWorklet(currentTimeMs);
  const formattedDuration = formatTimeWorklet(duration);
  const leftInset = Math.max(side, insets.left + 8);
  const rightInset = Math.max(side, insets.right + 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { bottom: insets.bottom + 10 + bottomExtra, left: leftInset, right: rightInset },
      ]}
    >
      <View pointerEvents="box-none" style={[styles.content, { maxWidth: maxContentWidth }]}>
        <View pointerEvents="box-none" style={styles.progressRow}>
          <Animated.Text pointerEvents="none" style={[styles.timeText, fadeAnimatedStyle]}>
            {formattedCurrentTime}
          </Animated.Text>
          <Animated.View
            pointerEvents={showControls ? 'auto' : 'none'}
            style={[styles.progressSlider, fadeAnimatedStyle]}
          >
            <PlayerProgressSlider
              accessibilityStep={duration > 0 ? Math.min(1, 10_000 / duration) : 0.01}
              accessibilityValue={`${formattedCurrentTime} / ${formattedDuration}`}
              bufferedProgress={bufferedProgress}
              disabled={isLoading || duration <= 0}
              onSlidingComplete={handleSliderSlidingComplete}
              onSlidingStart={() => setIsDragging(true)}
              progress={progressValue}
            />
          </Animated.View>
          <Animated.Text pointerEvents="none" style={[styles.timeText, fadeAnimatedStyle]}>
            {formattedDuration}
          </Animated.Text>
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.bottomRow, stackBottomControls && styles.stackedBottomRow]}
        >
          <TransportControls />
          <View
            pointerEvents="box-none"
            style={[styles.actionRow, !stackBottomControls && styles.inlineActionRow]}
          >
            <PlayerActionBar />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  content: {
    alignSelf: 'center',
    gap: 10,
    width: '100%',
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  progressSlider: {
    flex: 1,
    height: 44,
  },
  timeText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Roboto',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  stackedBottomRow: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  actionRow: {
    alignSelf: 'flex-end',
  },
  inlineActionRow: {
    marginLeft: 'auto',
  },
});
