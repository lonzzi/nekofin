import { useCurrentTime } from '@/hooks/useCurrentTime';
import { formatTimeWorklet } from '@/lib/utils';
import { visibleChapters } from '@/services/media/segments';
import { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaybackInfoBadges } from './PlaybackInfoBadges';
import { PlayerActionBar } from './PlayerActionBar';
import { usePlayer } from './PlayerContext';
import { PlayerProgressSlider } from './PlayerProgressSlider';
import { TransportControls } from './TransportControls';
import { useOverlayInsets } from './useOverlayInsets';

export function BottomControls() {
  const { side, safeSideGap, bottomExtra, maxContentWidth } = useOverlayInsets();
  const insets = useSafeAreaInsets();
  const {
    bufferedProgress,
    currentItem,
    canSeek,
    currentTime,
    seekPreviewTime,
    seekPreviewStartTime,
    isGestureSeekingActive,
    clearControlsTimeout,
    duration,
    fadeAnim,
    hideControlsWithDelay,
    isDragging,
    isLocked,
    isInteractionLocked,
    onSeek,
    setIsDragging,
    showControls,
  } = usePlayer();
  const displayedTime = useDerivedValue(() =>
    isDragging || isGestureSeekingActive.value ? seekPreviewTime.value : currentTime.value,
  );
  const currentTimeMs = useCurrentTime({ time: displayedTime });
  const chapters = visibleChapters(currentItem?.chapters ?? [], duration);

  const fadeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));
  const progressValue = useSharedValue(0);

  useDerivedValue(() => {
    if (!isDragging && duration > 0) {
      progressValue.set(displayedTime.value / duration);
    }
  });

  const seekToTime = useCallback(
    (time: number) => {
      if (!canSeek || isInteractionLocked()) return;
      const clampedTime = Math.max(0, Math.min(time, duration));
      onSeek(clampedTime / duration);
    },
    [canSeek, duration, isInteractionLocked, onSeek],
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
  const leftInset = Math.max(side, insets.left + safeSideGap);
  const rightInset = Math.max(side, insets.right + safeSideGap);
  const bottomInset = insets.bottom + (Platform.OS === 'ios' ? 16 : 24) + bottomExtra;

  const progressSlider = (
    <PlayerProgressSlider
      accessibilityStep={duration > 0 ? Math.min(1, 10_000 / duration) : 0.01}
      accessibilityValue={`${formattedCurrentTime} / ${formattedDuration}`}
      bufferedProgress={bufferedProgress}
      disabled={isLocked || !canSeek}
      onSlidingComplete={handleSliderSlidingComplete}
      onSlidingCancel={() => {
        progressValue.value = duration > 0 ? currentTime.value / duration : 0;
        setIsDragging(false);
        hideControlsWithDelay();
      }}
      onSlidingStart={() => {
        if (isInteractionLocked()) return;
        clearControlsTimeout();
        seekPreviewStartTime.value = currentTime.value;
        seekPreviewTime.value = currentTime.value;
        setIsDragging(true);
      }}
      onValueChange={(value) => {
        if (isInteractionLocked()) return;
        seekPreviewTime.value = value * duration;
      }}
      progress={progressValue}
    />
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: bottomInset, left: leftInset, right: rightInset }]}
    >
      <View pointerEvents="box-none" style={[styles.content, { maxWidth: maxContentWidth }]}>
        <View pointerEvents="box-none" style={styles.metadataRow}>
          <PlaybackInfoBadges />
          <Animated.Text pointerEvents="none" style={[styles.timeText, fadeAnimatedStyle]}>
            {formattedCurrentTime} / {formattedDuration}
          </Animated.Text>
        </View>
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          style={[
            styles.progressSlider,
            Platform.OS === 'android' && styles.androidProgressSlider,
            fadeAnimatedStyle,
          ]}
        >
          {progressSlider}
          <View
            pointerEvents="none"
            style={[
              styles.chapterMarkers,
              Platform.OS === 'android' && styles.androidChapterMarkers,
            ]}
          >
            {chapters
              .filter((chapter) => chapter.startTimeMs > 0)
              .map((chapter) => (
                <View
                  key={chapter.startTimeMs}
                  style={[
                    styles.chapterMarker,
                    { left: `${(chapter.startTimeMs / duration) * 100}%` },
                  ]}
                />
              ))}
          </View>
        </Animated.View>
        <View pointerEvents="box-none" style={styles.bottomRow}>
          <TransportControls />
          <View pointerEvents="box-none" style={styles.actionRow}>
            <PlayerActionBar />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chapterMarkers: { position: 'absolute', left: 0, right: 0, top: 18, height: 8, zIndex: 1 },
  androidChapterMarkers: { left: 14, right: 14 },
  chapterMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#fff',
    borderColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1.5,
    borderRadius: 4,
    transform: [{ translateX: -4 }],
  },
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  content: {
    alignSelf: 'center',
    gap: 0,
    width: '100%',
  },
  metadataRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 2,
  },
  androidProgressSlider: { marginVertical: 6, paddingHorizontal: 14 },
  progressSlider: {
    height: 44,
  },
  timeText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    marginLeft: 'auto',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    justifyContent: 'space-between',
    // Reserve room for the standalone lock button at the bottom right.
    paddingRight: 52,
  },
  actionRow: {
    marginLeft: 'auto',
  },
});
