import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { PlayerProgressSliderProps } from './PlayerProgressSlider.types';

export function PlayerProgressSlider({
  accessibilityStep,
  accessibilityValue,
  bufferedProgress,
  disabled = false,
  onSlidingComplete,
  onSlidingStart,
  onSlidingCancel,
  onValueChange,
  progress,
}: PlayerProgressSliderProps) {
  const width = useSharedValue(1);
  const pressed = useSharedValue(false);
  const start = () => {
    onSlidingStart();
    void Haptics.selectionAsync();
  };
  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onStart((event) => {
      pressed.value = true;
      scheduleOnRN(start);
      progress.value = Math.max(0, Math.min(1, event.x / width.value));
      scheduleOnRN(onValueChange, progress.value);
    })
    .onUpdate((event) => {
      progress.value = Math.max(0, Math.min(1, event.x / width.value));
      scheduleOnRN(onValueChange, progress.value);
    })
    .onEnd(() => {
      scheduleOnRN(onSlidingComplete, progress.value);
    })
    .onFinalize((_event, success) => {
      if (pressed.value && !success) scheduleOnRN(onSlidingCancel);
      pressed.value = false;
    });
  const trackStyle = useAnimatedStyle(() => ({
    height: withTiming(pressed.value ? 7 : 3, { duration: 150 }),
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const bufferStyle = useAnimatedStyle(() => ({
    width: `${(bufferedProgress?.value ?? 0) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: progress.value * width.value - 7,
    transform: [{ scale: withTiming(pressed.value ? 1.25 : 0.8, { duration: 150 }) }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="播放进度"
        accessibilityValue={{ text: accessibilityValue }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (disabled) return;
          const next = Math.max(
            0,
            Math.min(
              1,
              progress.value +
                (nativeEvent.actionName === 'increment' ? accessibilityStep : -accessibilityStep),
            ),
          );
          progress.value = next;
          onSlidingComplete(next);
        }}
        onLayout={({ nativeEvent }) => {
          width.value = nativeEvent.layout.width;
        }}
        style={styles.container}
      >
        <Animated.View style={[styles.track, trackStyle]}>
          <Animated.View style={[styles.buffer, bufferStyle]} />
          <Animated.View style={[styles.fill, fillStyle]} />
        </Animated.View>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, height: 44, justifyContent: 'center' },
  track: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.24)' },
  fill: { position: 'absolute', height: '100%', backgroundColor: '#fff' },
  buffer: { position: 'absolute', height: '100%', backgroundColor: 'rgba(255,255,255,0.4)' },
  thumb: {
    position: 'absolute',
    top: 15,
    height: 14,
    width: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
});
