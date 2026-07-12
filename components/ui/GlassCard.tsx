import {
  GlassContainer as ExpoGlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassContainerProps,
  type GlassViewProps,
} from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type GlassCardProps = PropsWithChildren<
  Omit<GlassViewProps, 'children' | 'style'> & {
    fallbackBackgroundColor?: string;
    radius?: number;
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

export function SafeGlassContainer({ spacing, ...props }: GlassContainerProps) {
  const useLiquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  if (!useLiquidGlass) {
    return <View {...props} />;
  }

  return <ExpoGlassContainer spacing={spacing} {...props} />;
}

export function GlassCard({
  children,
  fallbackBackgroundColor,
  glassEffectStyle = 'regular',
  radius = 12,
  style,
  tintColor = 'rgba(255,255,255,0.10)',
  ...props
}: GlassCardProps) {
  const useLiquidGlass = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const radiusStyle = { borderRadius: radius };
  const surfaceStyle = [
    styles.surface,
    radiusStyle,
    !useLiquidGlass && { backgroundColor: fallbackBackgroundColor ?? 'transparent' },
    style,
  ];

  if (!useLiquidGlass) {
    return <View style={surfaceStyle}>{children}</View>;
  }

  return (
    <GlassView
      style={surfaceStyle}
      glassEffectStyle={glassEffectStyle}
      tintColor={tintColor}
      {...props}
    >
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
  shadow: {
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
});
