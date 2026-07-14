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
    surface?: 'material' | 'solid' | 'transparent';
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
  surface = 'solid',
  tintColor,
  useGlassEffect = false,
  ...props
}: GlassCardProps) {
  const theme = useAppTheme();
  const useLiquidGlass = useGlassEffect && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const useStandardMaterial = !useGlassEffect && surface === 'material';
  const blurTint =
    colorScheme === 'dark' || colorScheme === 'light'
      ? colorScheme
      : theme.colorScheme === 'dark' || theme.colorScheme === 'light'
        ? theme.colorScheme
        : 'default';
  const backgroundColor = useGlassEffect
    ? useLiquidGlass
      ? 'transparent'
      : (fallbackBackgroundColor ?? theme.colors.surface)
    : useStandardMaterial
      ? theme.isDark
        ? 'rgba(28,28,30,0.46)'
        : 'rgba(242,242,247,0.34)'
      : surface === 'solid'
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

  if (useGlassEffect || useStandardMaterial) {
    return (
      <BlurView
        intensity={useGlassEffect ? 42 : 32}
        tint={blurTint}
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
