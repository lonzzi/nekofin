import { useAppTheme } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type CoverFrameProps = PropsWithChildren<{
  aspectRatio: number;
  emphasized?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function CoverFrame({
  aspectRatio,
  children,
  emphasized = false,
  radius = 14,
  style,
}: CoverFrameProps) {
  const theme = useAppTheme();
  const colors: [string, string, string] = theme.isDark
    ? emphasized
      ? ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.18)']
      : ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.055)', 'rgba(0,0,0,0.12)']
    : emphasized
      ? ['rgba(255,255,255,0.94)', 'rgba(15,23,42,0.11)', 'rgba(15,23,42,0.18)']
      : ['rgba(255,255,255,0.82)', 'rgba(15,23,42,0.055)', 'rgba(15,23,42,0.11)'];

  return (
    <LinearGradient
      colors={colors}
      locations={[0, 0.46, 1]}
      start={{ x: 0.08, y: 0 }}
      end={{ x: 0.92, y: 1 }}
      style={[
        styles.frame,
        {
          aspectRatio,
          borderRadius: radius,
          padding: emphasized ? 1 : StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: Math.max(radius - 1, 0),
          },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
