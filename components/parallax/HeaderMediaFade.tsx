import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { HEADER_FADE_COLORS, HEADER_FADE_LOCATIONS } from './headerFadeGradient';

export function HeaderMediaFade({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <MaskedView
      style={style}
      maskElement={
        <LinearGradient
          colors={HEADER_FADE_COLORS}
          locations={HEADER_FADE_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      {children}
    </MaskedView>
  );
}
