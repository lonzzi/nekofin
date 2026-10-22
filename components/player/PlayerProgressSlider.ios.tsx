import { useTranslation } from '@/lib/i18n';
import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps } from 'react-native-reanimated';

import type { PlayerProgressSliderProps } from './PlayerProgressSlider.types';

type SliderEvent = NativeSyntheticEvent<{ value: number }>;

type NativePlayerScrubberProps = ViewProps & {
  accessibilityStep?: number;
  bufferedValue?: number;
  disabled?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  onSlidingComplete?: (event: SliderEvent) => void;
  onSlidingCancel?: (event: SliderEvent) => void;
  onSlidingStart?: (event: SliderEvent) => void;
  onValueChange?: (event: SliderEvent) => void;
  sliderAccessibilityHint?: string;
  sliderAccessibilityLabel?: string;
  sliderAccessibilityValue?: string;
  value?: number;
};

const NativePlayerScrubber: ComponentType<NativePlayerScrubberProps> =
  requireNativeView('PlayerScrubber');
const AnimatedPlayerScrubber = Animated.createAnimatedComponent(NativePlayerScrubber);

export function PlayerProgressSlider({
  accessibilityStep,
  accessibilityValue,
  bufferedProgress,
  disabled = false,
  onSlidingComplete,
  onSlidingCancel,
  onSlidingStart,
  onValueChange,
  progress,
}: PlayerProgressSliderProps) {
  const { t: tr } = useTranslation();
  const animatedProps = useAnimatedProps<NativePlayerScrubberProps>(() => ({
    bufferedValue: bufferedProgress?.get() ?? 0,
    value: progress.get(),
  }));
  const nativeGesture = Gesture.Native().disallowInterruption(true);

  return (
    <GestureDetector gesture={nativeGesture}>
      <AnimatedPlayerScrubber
        accessible
        accessibilityHint={tr('player.skipGestureHint')}
        accessibilityLabel={tr('player.position')}
        accessibilityRole="adjustable"
        accessibilityStep={accessibilityStep}
        accessibilityValue={{ text: accessibilityValue }}
        disabled={disabled}
        maximumValue={1}
        minimumValue={0}
        onSlidingComplete={({ nativeEvent }) => onSlidingComplete(nativeEvent.value)}
        onSlidingCancel={onSlidingCancel}
        onSlidingStart={onSlidingStart}
        onValueChange={({ nativeEvent }) => {
          progress.value = nativeEvent.value;
          onValueChange(nativeEvent.value);
        }}
        nativeID="PlayerProgressSlider"
        sliderAccessibilityHint={tr('player.seekGestureHint')}
        sliderAccessibilityLabel={tr('player.position')}
        sliderAccessibilityValue={accessibilityValue}
        style={{ flex: 1, height: 44 }}
        animatedProps={animatedProps}
      />
    </GestureDetector>
  );
}
