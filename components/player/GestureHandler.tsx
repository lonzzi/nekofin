import { usePlayerGestureSettings } from '@/hooks/usePlayerGestureSettings';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { VolumeManager } from 'react-native-volume-manager';
import { scheduleOnRN } from 'react-native-worklets';

import {
  calculateSeekGesture,
  calculateVerticalGestureValue,
  getVerticalGestureMode,
  isHorizontalPan,
  isVerticalPan,
  type VerticalGestureMode,
} from './gestureMath';
import { GestureValuePreview } from './GestureValuePreview';
import { usePlayer } from './PlayerContext';

type PanMode = VerticalGestureMode | 'seek';

const selectionFeedback = () => {
  void Haptics.selectionAsync();
};

export function GestureHandler() {
  const {
    canSeek,
    duration,
    currentTime,
    onSeek,
    onPlayPause,
    onRateChange,
    showControls,
    setShowControls,
    isLoading,
    isLocked,
    isInteractionLocked,
    isPanelOpen,
    isDragging,
    isGestureSeekingActive,
    isVolumeGestureActive,
    isBrightnessGestureActive,
    hideControlsWithDelay,
    clearControlsTimeout,
    seekPreviewTime,
    seekPreviewStartTime,
  } = usePlayer();
  const { brightnessGestureEnabled, volumeGestureEnabled } = usePlayerGestureSettings();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isInitialized, setIsInitialized] = useState(false);
  const volumeValue = useSharedValue(1);
  const brightnessValue = useSharedValue(1);
  const panMode = useSharedValue<PanMode | null>(null);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const activationX = useSharedValue(0);
  const activationY = useSharedValue(0);
  const systemStartValue = useSharedValue(0);
  const lastSystemUpdate = useSharedValue(0);
  const boostActive = useSharedValue(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([Brightness.getBrightnessAsync(), VolumeManager.getVolume()])
      .then(([brightness, { volume }]) => {
        if (!mounted) return;
        brightnessValue.value = brightness;
        volumeValue.value = volume;
        setIsInitialized(true);
      })
      .catch(() => {});
    const subscription = VolumeManager.addVolumeListener(({ volume }) => {
      if (!isVolumeGestureActive.value) volumeValue.value = volume;
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [brightnessValue, volumeValue, isVolumeGestureActive]);

  const writeSystemValue = useCallback(
    (mode: VerticalGestureMode, value: number) => {
      if (isInteractionLocked()) return;
      const operation =
        mode === 'brightness'
          ? Brightness.setBrightnessAsync(value)
          : VolumeManager.setVolume(value);
      void operation.catch(() => {});
    },
    [isInteractionLocked],
  );

  const startSeek = useCallback(() => {
    if (isInteractionLocked()) return;
    clearControlsTimeout();
    setShowControls(true);
    selectionFeedback();
  }, [clearControlsTimeout, isInteractionLocked, setShowControls]);
  const finishSeek = useCallback(
    (time: number, commit: boolean) => {
      if (isInteractionLocked()) return;
      if (commit && canSeek) onSeek(time / duration);
      hideControlsWithDelay();
    },
    [canSeek, duration, onSeek, hideControlsWithDelay, isInteractionLocked],
  );
  const handlePlayPause = useCallback(() => {
    if (!isInteractionLocked()) onPlayPause();
  }, [isInteractionLocked, onPlayPause]);
  const startSpeedBoost = useCallback(() => {
    if (isInteractionLocked()) return;
    selectionFeedback();
    onRateChange?.(3, { remember: false });
  }, [isInteractionLocked, onRateChange]);

  // Decide once, after a deliberate movement. Vertical drift after activation
  // must never cancel seeking or change it into a brightness/volume gesture.
  const panGesture = Gesture.Pan()
    .enabled(!isLocked && !isPanelOpen && !isDragging)
    .manualActivation(true)
    .maxPointers(1)
    .onTouchesDown((event, manager) => {
      if (event.numberOfTouches !== 1) {
        manager.fail();
        return;
      }
      const touch = event.allTouches[0];
      if (!touch) return;
      touchStartX.value = touch.x;
      touchStartY.value = touch.y;
      panMode.value = null;
    })
    .onTouchesMove((event, manager) => {
      if (panMode.value) return;
      const touch = event.allTouches[0];
      if (!touch || event.numberOfTouches !== 1) {
        manager.fail();
        return;
      }
      const x = touch.x - touchStartX.value;
      const y = touch.y - touchStartY.value;
      if (isHorizontalPan(x, y) && canSeek) {
        panMode.value = 'seek';
      } else if (isVerticalPan(x, y) && isInitialized && !isLoading) {
        const mode = getVerticalGestureMode(touchStartX.value, screenWidth, {
          brightnessGestureEnabled,
          volumeGestureEnabled,
        });
        if (!mode) {
          manager.fail();
          return;
        }
        panMode.value = mode;
      } else {
        return;
      }
      activationX.value = x;
      activationY.value = y;
      manager.activate();
    })
    .onTouchesUp((_event, manager) => {
      if (!panMode.value) manager.fail();
    })
    .onStart(() => {
      if (panMode.value === 'seek') {
        seekPreviewStartTime.value = currentTime.value;
        seekPreviewTime.value = currentTime.value;
        isGestureSeekingActive.value = true;
        scheduleOnRN(startSeek);
      } else {
        const brightness = panMode.value === 'brightness';
        systemStartValue.value = brightness ? brightnessValue.value : volumeValue.value;
        isBrightnessGestureActive.value = brightness;
        isVolumeGestureActive.value = !brightness;
        lastSystemUpdate.value = 0;
        scheduleOnRN(clearControlsTimeout);
        scheduleOnRN(selectionFeedback);
      }
    })
    .onUpdate((event) => {
      if (panMode.value === 'seek') {
        seekPreviewTime.value = calculateSeekGesture({
          translationX: event.translationX - activationX.value,
          screenWidth,
          duration,
          startTime: seekPreviewStartTime.value,
        }).time;
      } else if (panMode.value) {
        const { value } = calculateVerticalGestureValue({
          translationY: event.translationY - activationY.value,
          screenHeight,
          startValue: systemStartValue.value,
        });
        if (panMode.value === 'brightness') brightnessValue.value = value;
        else volumeValue.value = value;
        // RNGH executes this callback on touch updates on the UI thread.
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        if (now - lastSystemUpdate.value >= 70) {
          lastSystemUpdate.value = now;
          scheduleOnRN(writeSystemValue, panMode.value, value);
        }
      }
    })
    .onFinalize((_event, success) => {
      if (isGestureSeekingActive.value) {
        isGestureSeekingActive.value = false;
        scheduleOnRN(finishSeek, seekPreviewTime.value, success);
      } else if (
        (panMode.value === 'brightness' || panMode.value === 'volume') &&
        (isBrightnessGestureActive.value || isVolumeGestureActive.value)
      ) {
        scheduleOnRN(
          writeSystemValue,
          panMode.value,
          panMode.value === 'brightness' ? brightnessValue.value : volumeValue.value,
        );
        scheduleOnRN(hideControlsWithDelay);
      }
      isBrightnessGestureActive.value = false;
      isVolumeGestureActive.value = false;
      isGestureSeekingActive.value = false;
      panMode.value = null;
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(!isLocked && !isPanelOpen && !isDragging)
    .numberOfTaps(2)
    .maxDuration(250)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(handlePlayPause);
    });
  const handleSingleTap = () => {
    if (isInteractionLocked()) return;
    clearControlsTimeout();
    setShowControls(!showControls);
  };
  const tapGesture = Gesture.Tap()
    .enabled(!isLocked && !isPanelOpen && !isDragging)
    .maxDuration(280)
    .maxDeltaX(16)
    .maxDeltaY(16)
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(handleSingleTap);
    });
  const longPressGesture = Gesture.LongPress()
    .enabled(!isLocked && !isPanelOpen && !isLoading && !isDragging)
    .minDuration(500)
    .maxDistance(12)
    .onStart(() => {
      if (!onRateChange) return;
      boostActive.value = true;
      scheduleOnRN(startSpeedBoost);
    })
    .onFinalize(() => {
      if (boostActive.value && onRateChange) {
        boostActive.value = false;
        scheduleOnRN(onRateChange, null);
      }
    });
  const composed = Gesture.Race(
    longPressGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, tapGesture),
  );

  return (
    <Fragment>
      {!isLocked ? (
        <GestureValuePreview
          brightness={brightnessValue}
          volume={volumeValue}
          isBrightnessActive={isBrightnessGestureActive}
          isVolumeActive={isVolumeGestureActive}
        />
      ) : null}
      <GestureDetector gesture={composed}>
        <Animated.View style={styles.touchOverlay} />
      </GestureDetector>
    </Fragment>
  );
}

const styles = StyleSheet.create({
  touchOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 5 },
});
