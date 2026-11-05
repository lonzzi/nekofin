import { useAppTheme } from '@/lib/theme';
import type { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type CoverFrameProps = PropsWithChildren<{
  aspectRatio: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function CoverFrame({ aspectRatio, children, radius = 14, style }: CoverFrameProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.frame,
        {
          aspectRatio,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceMuted,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
