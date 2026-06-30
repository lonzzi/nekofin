import { useAppTheme } from '@/lib/design-system';
import { GlassView, isLiquidGlassAvailable, type GlassViewProps } from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type GlassCardProps = PropsWithChildren<
  Omit<GlassViewProps, 'children' | 'style'> & {
    fallbackBackgroundColor?: string;
    radius?: number;
    rimStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
  }
>;

type ShadowedGlassCardProps = GlassCardProps & {
  containerStyle?: StyleProp<ViewStyle>;
};

type GlassShadowProps = PropsWithChildren<{
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function GlassShadow({ children, radius = 12, style }: GlassShadowProps) {
  return <View style={[styles.shadow, { borderRadius: radius }, style]}>{children}</View>;
}

export function GlassCard({
  children,
  fallbackBackgroundColor,
  glassEffectStyle = 'regular',
  radius = 12,
  rimStyle,
  style,
  tintColor = 'rgba(255,255,255,0.10)',
  ...props
}: GlassCardProps) {
  const theme = useAppTheme();
  const useLiquidGlass = isLiquidGlassAvailable();
  const radiusStyle = { borderRadius: radius };

  return (
    <GlassView
      style={[
        styles.surface,
        radiusStyle,
        !useLiquidGlass && { backgroundColor: fallbackBackgroundColor ?? theme.colors.surface },
        style,
      ]}
      glassEffectStyle={glassEffectStyle}
      tintColor={tintColor}
      {...props}
    >
      <View pointerEvents="none" style={[styles.rim, radiusStyle, rimStyle]} />
      {children}
    </GlassView>
  );
}

export function ShadowedGlassCard({
  containerStyle,
  radius = 12,
  ...props
}: ShadowedGlassCardProps) {
  return (
    <GlassShadow radius={radius} style={containerStyle}>
      <GlassCard radius={radius} {...props} />
    </GlassShadow>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  rim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  shadow: {
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
});
