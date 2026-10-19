import { AndroidNavigationSurface } from '@/modules/native-layout/AndroidNavigationSurface';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { PlayerGlassSurfaceProps } from './PlayerGlassSurface.types';

/** Navigation material without replaying the player's live SurfaceView. */
export function PlayerGlassSurface({
  children,
  contentStyle,
  fadeProgress,
  pointerEvents,
  radius = 999,
  style,
  surfaceStyle,
  visible,
}: PlayerGlassSurfaceProps) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeProgress.get() }));

  return (
    <Animated.View
      pointerEvents={pointerEvents ?? (visible ? 'auto' : 'none')}
      style={[style, fadeStyle]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          surfaceStyle,
          styles.surface,
          {
            borderRadius: radius,
            backgroundColor: reduceTransparency ? '#111318' : 'transparent',
          },
        ]}
      >
        <AndroidNavigationSurface
          color="#111318"
          cornerRadius={radius}
          sampleContent={false}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: 0 },
  content: { position: 'relative' },
});
