import { formatTimeWorklet } from '@/lib/utils';
import { BlurView } from 'expo-blur';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  setNativeProps,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { VolumeManager } from 'react-native-volume-manager';
import { scheduleOnRN } from 'react-native-worklets';

import { usePlayer } from './PlayerContext';
import { VerticalSlider } from './VerticalSlider';

const throttleWorklet = (callback: () => void, delay: number) => {
  'worklet';

  let timeoutId: number | null = null;

  return () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      callback();
      timeoutId = null;
    }, delay);
  };
};

export function GestureHandler() {
  const {
    duration,
    currentTime,
    onSeek,
    onPlayPause,
    onRateChange,
    showControls,
    setShowControls,
    menuOpen,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
    hideControlsWithDelay,
    clearControlsTimeout,
  } = usePlayer();
  const { width: screenWidth } = useWindowDimensions();
  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [isInitialized, setIsInitialized] = useState(false);

  const animatedTextInputRef = useAnimatedRef<TextInput>();
  const animatedOffsetTextInputRef = useAnimatedRef<TextInput>();

  const gestureSeekPreview = useSharedValue(0);
  const gestureSeekOffset = useSharedValue(0);
  const gestureVolumePreview = useSharedValue(0);
  const gestureVolumeOffset = useSharedValue(0);
  const gestureBrightnessPreview = useSharedValue(0);
  const gestureBrightnessOffset = useSharedValue(0);
  const volumeSliderValue = useSharedValue(1.0);
  const brightnessSliderValue = useSharedValue(1.0);

  const sliderMode = useSharedValue<'brightness' | 'volume' | null>(null);

  const gestureSeekStartTime = useSharedValue(0);
  const gestureVolumeStartValue = useSharedValue(0);
  const gestureBrightnessStartValue = useSharedValue(0);

  const minimumValue = useSharedValue(0);
  const maximumValue = useSharedValue(1);

  const totalTime = formatTimeWorklet(duration);

  const seekPreviewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isGestureSeekingActive.value ? 1 : 0, { duration: 100 }),
  }));

  const volumePreviewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isVolumeGestureActive.value ? 1 : 0, { duration: 100 }),
  }));

  const brightnessPreviewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isBrightnessGestureActive.value ? 1 : 0, { duration: 100 }),
  }));

  useEffect(() => {
    const initializeSystemValues = async () => {
      const systemBrightness = await Brightness.getBrightnessAsync();
      setBrightness(systemBrightness);
      brightnessSliderValue.value = systemBrightness;

      const { volume: systemVolume } = await VolumeManager.getVolume();
      setVolume(systemVolume);
      volumeSliderValue.value = systemVolume;

      setIsInitialized(true);
    };

    initializeSystemValues();
  }, [brightnessSliderValue, volumeSliderValue]);

  const handleSeek = useCallback(
    (position: number) => {
      if (!duration) return;
      const clampedTime = Math.max(0, Math.min(position, duration));
      const newPosition = duration > 0 ? clampedTime / duration : 0;
      onSeek(newPosition);
    },
    [duration, onSeek],
  );

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    await VolumeManager.setVolume(newVolume);
  }, []);

  const throttledBrightnessChange = useCallback(async (newBrightness: number) => {
    setBrightness(newBrightness);
    await Brightness.setBrightnessAsync(newBrightness);
  }, []);

  const handleBrightnessChange = useCallback(
    (newBrightness: number) => {
      const throttledCallback = throttleWorklet(() => {
        scheduleOnRN(throttledBrightnessChange, newBrightness);
      }, 50);

      throttledCallback();
    },
    [throttledBrightnessChange],
  );

  const handleGestureSeekStart = useCallback(() => {
    isGestureSeekingActive.value = true;
    setShowControls(true);
  }, [isGestureSeekingActive, setShowControls]);

  const handleGestureSeekEnd = useCallback(
    (finalTime: number) => {
      handleSeek(finalTime);
      isGestureSeekingActive.value = false;
      hideControlsWithDelay();
    },
    [handleSeek, isGestureSeekingActive, hideControlsWithDelay],
  );

  const handleVolumeGestureStart = useCallback(() => {
    isVolumeGestureActive.value = true;
  }, [isVolumeGestureActive]);

  const handleVolumeGestureEnd = useCallback(
    (finalVolume: number) => {
      handleVolumeChange(finalVolume);
      isVolumeGestureActive.value = false;
    },
    [handleVolumeChange, isVolumeGestureActive],
  );

  const handleBrightnessGestureStart = useCallback(() => {
    isBrightnessGestureActive.value = true;
  }, [isBrightnessGestureActive]);

  const handleBrightnessGestureEnd = useCallback(
    (finalBrightness: number) => {
      throttledBrightnessChange(finalBrightness);
      isBrightnessGestureActive.value = false;
    },
    [throttledBrightnessChange, isBrightnessGestureActive],
  );

  const handleSingleTap = () => {
    if (menuOpen) {
      return;
    }

    clearControlsTimeout();
    setShowControls(!showControls);
  };

  const handleDoubleTap = () => {
    onPlayPause();
  };

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .activeOffsetX([-15, 15])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .onStart(() => {
      scheduleOnRN(handleGestureSeekStart);
      gestureSeekStartTime.value = currentTime.value;
      gestureSeekOffset.value = 0;
      gestureSeekPreview.value = currentTime.value;
    })
    .onUpdate((event) => {
      'worklet';
      if (!duration) return;

      const deltaX = event.translationX;
      const deltaY = event.translationY;

      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
        return;
      }

      if (isVolumeGestureActive.value || isBrightnessGestureActive.value) {
        return;
      }

      if (!isGestureSeekingActive.value) {
        scheduleOnRN(handleGestureSeekStart);
      }

      const progressRatio = deltaX / screenWidth;
      const timeChange = progressRatio * 180000;

      gestureSeekOffset.value = timeChange;
      const newTime = Math.max(0, Math.min(duration, gestureSeekStartTime.value + timeChange));

      const time = newTime;
      gestureSeekPreview.value = time;

      setNativeProps(animatedTextInputRef, {
        text: `${formatTimeWorklet(newTime)} / ${totalTime}`,
      });

      const offsetSeconds = Math.round(timeChange / 1000);
      const offsetText = offsetSeconds > 0 ? `+${offsetSeconds}s` : `${offsetSeconds}s`;

      setNativeProps(animatedOffsetTextInputRef, {
        text: offsetText,
      });
    })
    .onEnd(() => {
      if (!duration) return;

      const finalTime = gestureSeekPreview.value;
      scheduleOnRN(handleGestureSeekEnd, finalTime);
    });

  const verticalSliderGesture = Gesture.Pan()
    .minDistance(8)
    .activeOffsetY([-10, 10])
    .failOffsetX([-8, 8])
    .maxPointers(1)
    .onStart((event) => {
      const isLeftSide = event.x < screenWidth * 0.5;
      const isRightSide = event.x >= screenWidth * 0.5;

      if (isLeftSide) {
        if (!isInitialized) {
          return;
        }
        sliderMode.value = 'brightness';
        gestureBrightnessStartValue.value = brightness;
        gestureBrightnessOffset.value = 0;
        gestureBrightnessPreview.value = brightness;
      } else if (isRightSide) {
        sliderMode.value = 'volume';
        gestureVolumeStartValue.value = volume;
        gestureVolumeOffset.value = 0;
        gestureVolumePreview.value = volume;
      }
    })
    .onUpdate((event) => {
      'worklet';

      const isLeftSide = sliderMode.value === 'brightness';
      const isRightSide = sliderMode.value === 'volume';

      const deltaY = event.translationY;
      const deltaX = event.translationX;

      if (Math.abs(deltaY) <= Math.abs(deltaX) * 1.2) {
        return;
      }

      if (isLeftSide) {
        if (!isInitialized) {
          return;
        }

        if (!isBrightnessGestureActive.value) {
          scheduleOnRN(handleBrightnessGestureStart);
        }

        const progressRatio = -deltaY / (screenWidth * 0.3);
        const brightnessChange = progressRatio * 0.6;

        gestureBrightnessOffset.value = brightnessChange;
        const newBrightness = Math.max(
          0,
          Math.min(1, gestureBrightnessStartValue.value + brightnessChange),
        );

        gestureBrightnessPreview.value = newBrightness;
        brightnessSliderValue.value = newBrightness;

        scheduleOnRN(handleBrightnessChange, newBrightness);
      } else if (isRightSide) {
        if (!isVolumeGestureActive.value) {
          scheduleOnRN(handleVolumeGestureStart);
        }

        const progressRatio = -deltaY / (screenWidth * 0.3);
        const volumeChange = progressRatio * 0.6;

        gestureVolumeOffset.value = volumeChange;
        const newVolume = Math.max(0, Math.min(1, gestureVolumeStartValue.value + volumeChange));

        gestureVolumePreview.value = newVolume;
        volumeSliderValue.value = newVolume;

        scheduleOnRN(handleVolumeChange, newVolume);
      }
    })
    .onEnd(() => {
      if (sliderMode.value === 'volume') {
        const finalVolume = gestureVolumePreview.value;
        scheduleOnRN(handleVolumeGestureEnd, finalVolume);
      }
      if (sliderMode.value === 'brightness') {
        const finalBrightness = gestureBrightnessPreview.value;
        scheduleOnRN(handleBrightnessGestureEnd, finalBrightness);
      }
      sliderMode.value = null;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (success) {
        scheduleOnRN(handleDoubleTap);
      }
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(280)
    .maxDelay(200)
    .maxDeltaX(16)
    .maxDeltaY(16)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((_event, success) => {
      if (success) {
        scheduleOnRN(handleSingleTap);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .maxDistance(9999)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      if (
        isGestureSeekingActive.value ||
        isVolumeGestureActive.value ||
        isBrightnessGestureActive.value
      ) {
        return;
      }
      if (onRateChange) {
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
        scheduleOnRN(onRateChange, 3, { remember: false });
      }
    })
    .onEnd((_event, _success) => {
      if (onRateChange) {
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
        scheduleOnRN(onRateChange, null);
      }
    });

  const tapGestures = Gesture.Exclusive(doubleTapGesture, tapGesture);
  const panGestures = Gesture.Exclusive(panGesture, verticalSliderGesture);
  const composed = Gesture.Race(longPressGesture, Gesture.Exclusive(panGestures, tapGestures));

  return (
    <Fragment>
      <Animated.View style={[styles.seekPreviewContainer, seekPreviewAnimatedStyle]}>
        <BlurView tint="dark" intensity={100} style={styles.seekPreviewBlur}>
          <TextInput
            ref={animatedOffsetTextInputRef}
            style={styles.seekPreviewOffsetText}
            caretHidden
            defaultValue=""
            editable={false}
          />
          <TextInput
            ref={animatedTextInputRef}
            style={styles.seekPreviewText}
            caretHidden
            defaultValue=""
            editable={false}
          />
        </BlurView>
      </Animated.View>
      <VerticalSlider
        iconName="volume-high"
        progress={volumeSliderValue}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        style={[volumePreviewAnimatedStyle, styles.volumeSliderContainer]}
      />
      <VerticalSlider
        iconName="sunny"
        progress={brightnessSliderValue}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        style={[brightnessPreviewAnimatedStyle, styles.brightnessSliderContainer]}
      />
      <GestureDetector gesture={composed}>
        <Animated.View style={styles.touchOverlay} />
      </GestureDetector>
    </Fragment>
  );
}

const styles = StyleSheet.create({
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  seekPreviewContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    zIndex: 15,
  },
  seekPreviewBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  seekPreviewOffsetText: {
    color: '#fff',
    fontSize: 18,
    paddingVertical: 0,
    fontFamily: 'Roboto',
    marginBottom: 4,
  },
  seekPreviewText: {
    color: '#fff',
    fontSize: 16,
    paddingVertical: 0,
    fontFamily: 'Roboto',
  },
  volumeSliderContainer: {
    left: 60,
  },
  brightnessSliderContainer: {
    right: 60,
  },
});
