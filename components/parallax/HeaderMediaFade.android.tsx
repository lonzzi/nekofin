import { requireNativeView } from 'expo';
import type { PropsWithChildren } from 'react';
import { processColor, type ViewProps } from 'react-native';

import { HEADER_FADE_COLORS, HEADER_FADE_LOCATIONS } from './headerFadeGradient';

const NativeMask = requireNativeView<
  ViewProps & { colors: number[]; locations: readonly number[] }
>('HeaderGradientMask');
const colors = HEADER_FADE_COLORS.map((color) => processColor(color) as number);

export function HeaderMediaFade({ children, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <NativeMask {...props} colors={colors} locations={HEADER_FADE_LOCATIONS}>
      {children}
    </NativeMask>
  );
}
