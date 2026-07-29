import type { SharedValue } from 'react-native-reanimated';

export type PlayerProgressSliderProps = {
  accessibilityStep: number;
  accessibilityValue: string;
  bufferedProgress?: SharedValue<number>;
  disabled?: boolean;
  onSlidingComplete: (value: number) => void;
  onSlidingStart: () => void;
  progress: SharedValue<number>;
};
