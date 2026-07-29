import { GlassCard } from '@/components/ui/GlassCard';
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassEffectStyleConfig,
} from 'expo-glass-effect';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type PlayerGlassSurfaceProps = PropsWithChildren<{
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

export function PlayerGlassSurface({
  children,
  contentStyle,
  effectStyle = 'clear',
  fadeProgress,
  fallbackBackgroundColor = 'rgba(15, 17, 22, 0.72)',
  isInteractive = true,
  pointerEvents,
  radius = 999,
  style,
  surfaceStyle,
  tintColor = 'rgba(8, 10, 14, 0.16)',
  visible,
}: PlayerGlassSurfaceProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const liquidGlassAvailable = useMemo(
    () => isLiquidGlassAvailable() && isGlassEffectAPIAvailable(),
    [],
  );
  const useLiquidGlass = liquidGlassAvailable && !reduceTransparency;
  const glassEffectStyle = useMemo<GlassEffectStyleConfig>(
    () => ({
      style: visible ? effectStyle : 'none',
      animate: !reduceMotion,
      animationDuration: visible ? 0.18 : 0.26,
    }),
    [effectStyle, reduceMotion, visible],
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const transparencySubscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );

    return () => {
      motionSubscription.remove();
      transparencySubscription.remove();
    };
  }, []);

  // Expo GlassView stops rendering after it or an ancestor reaches opacity 0.
  // Keep the native glass shell opaque and fade only its contents. Older iOS
  // versions and Android fade the BlurView fallback as one surface.
  const shellFadeStyle = useAnimatedStyle(() => ({
    opacity: useLiquidGlass ? 1 : fadeProgress.value,
  }));
  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: useLiquidGlass ? fadeProgress.value : 1,
  }));

  return (
    <Animated.View
      pointerEvents={pointerEvents ?? (visible ? 'auto' : 'none')}
      style={[style, shellFadeStyle]}
    >
      <GlassCard
        colorScheme="dark"
        fallbackBackgroundColor={reduceTransparency ? '#111318' : fallbackBackgroundColor}
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        pointerEvents="none"
        radius={radius}
        style={[
          StyleSheet.absoluteFill,
          styles.surface,
          useLiquidGlass ? styles.nativeGlassSurface : styles.fallbackSurface,
          surfaceStyle,
        ]}
        tintColor={tintColor}
        useGlassEffect={!reduceTransparency}
      />
      <Animated.View style={[styles.content, contentStyle, contentFadeStyle]}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    position: 'relative',
  },
  nativeGlassSurface: {
    // The native material already draws its own edge. Keeping a React Native
    // border here would leave a faint ring behind while glassEffectStyle is none.
    borderColor: 'transparent',
  },
  fallbackSurface: {
    borderColor: 'rgba(255,255,255,0.14)',
  },
});
