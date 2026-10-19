import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export type PlayerGlassSurfaceProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  fadeProgress: SharedValue<number>;
  fallbackBackgroundColor?: string;
  effectStyle?: 'clear' | 'regular';
  isInteractive?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  radius?: number;
  style?: StyleProp<ViewStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
  visible: boolean;
}>;
