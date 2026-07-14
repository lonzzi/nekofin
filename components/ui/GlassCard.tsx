import { useAppTheme } from '@/lib/theme';
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassViewProps,
} from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

type GlassCardProps = PropsWithChildren<
  Omit<GlassViewProps, 'children' | 'style'> & {
    fallbackBackgroundColor?: string;
    radius?: number;
    style?: StyleProp<ViewStyle>;
    surface?: 'filled' | 'transparent';
    useGlassEffect?: boolean;
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
  return <View style={[{ borderRadius: radius }, style]}>{children}</View>;
}

type SafeGlassContainerProps = PropsWithChildren<ViewProps & { spacing?: number }>;

export function SafeGlassContainer({ spacing: _spacing, ...props }: SafeGlassContainerProps) {
  return <View {...props} />;
}

export function GlassCard({
  children,
  colorScheme,
  fallbackBackgroundColor,
  glassEffectStyle = 'regular',
  isInteractive,
  radius = 12,
  style,
  surface = 'filled',
  tintColor,
  useGlassEffect = false,
  ...props
}: GlassCardProps) {
  const theme = useAppTheme();
  const useLiquidGlass = useGlassEffect && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const backgroundColor = useGlassEffect
    ? useLiquidGlass
      ? 'transparent'
      : (fallbackBackgroundColor ?? theme.colors.surface)
    : surface === 'filled'
      ? (fallbackBackgroundColor ?? theme.colors.surface)
      : 'transparent';
  const surfaceStyle = [styles.surface, { backgroundColor, borderRadius: radius }, style];

  if (useLiquidGlass) {
    return (
      <GlassView
        colorScheme={colorScheme}
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        style={surfaceStyle}
        tintColor={tintColor}
        {...props}
      >
        {children}
      </GlassView>
    );
  }

  if (useGlassEffect) {
    return (
      <BlurView
        intensity={42}
        tint={colorScheme === 'dark' || colorScheme === 'light' ? colorScheme : 'default'}
        style={surfaceStyle}
        {...(props as ViewProps)}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <View style={surfaceStyle} {...props}>
      {children}
    </View>
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
});
