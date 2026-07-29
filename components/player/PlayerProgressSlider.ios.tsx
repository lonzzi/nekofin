import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
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
  onSlidingStart,
  progress,
}: PlayerProgressSliderProps) {
  const animatedProps = useAnimatedProps<NativePlayerScrubberProps>(() => ({
    bufferedValue: bufferedProgress?.get() ?? 0,
    value: progress.get(),
  }));

  return (
    <AnimatedPlayerScrubber
      accessible
      accessibilityHint="上下轻扫可前进或后退 10 秒"
      accessibilityLabel="播放进度"
      accessibilityRole="adjustable"
      accessibilityStep={accessibilityStep}
      accessibilityValue={{ text: accessibilityValue }}
      disabled={disabled}
      maximumValue={1}
      minimumValue={0}
      onSlidingComplete={({ nativeEvent }) => onSlidingComplete(nativeEvent.value)}
      onSlidingStart={onSlidingStart}
      nativeID="PlayerProgressSlider"
      sliderAccessibilityHint="上下轻扫可调整播放位置"
      sliderAccessibilityLabel="播放进度"
      sliderAccessibilityValue={accessibilityValue}
      style={{ flex: 1, height: 44 }}
      animatedProps={animatedProps}
    />
  );
}
