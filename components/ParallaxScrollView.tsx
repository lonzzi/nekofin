import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurTint, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactElement } from 'react';
import { Easing, Platform, ScrollViewProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

const HEADER_HEIGHT = 450;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor?: { dark: string; light: string };
  headerHeight?: number;
  enableMaskView?: boolean;
  enableBlurEffect?: boolean;
  blurIntensity?: number;
  blurTint?: BlurTint;
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  maskViewStyle?: StyleProp<ViewStyle>;
  gradientStyle?: StyleProp<ViewStyle>;
  gradientColors?: [string, string];
  gradientLocations?: [number, number];
}> &
  ScrollViewProps;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = HEADER_HEIGHT,
  enableMaskView = false,
  enableBlurEffect = false,
  blurIntensity = 100,
  blurTint = Platform.OS === 'ios' ? 'systemChromeMaterialDark' : 'systemMaterialDark',
  containerStyle,
  contentStyle,
  maskViewStyle,
  gradientStyle,
  gradientColors,
  gradientLocations,
  ...props
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const gradientStartColor = colorScheme === 'light' ? 'rgba(252,255,255,0)' : 'rgba(0,0,0,0)';
  const gradientEndColor = colorScheme === 'light' ? 'rgba(252,255,255,1)' : 'rgba(0,0,0,1)';

  const blurGradientColors = enableBlurEffect
    ? {
        0: { color: 'transparent' },
        0.5: { color: 'rgba(0,0,0,0.99)' },
        1: { color: 'black' },
      }
    : {
        0: { color: gradientStartColor },
        1: { color: gradientEndColor },
      };

  const { colors, locations } = easeGradient({
    colorStops: blurGradientColors as any,
    easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    extraColorStopsPerTransition: 24,
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75],
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-headerHeight, 0, headerHeight], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <Animated.ScrollView
      style={[styles.container, containerStyle]}
      ref={scrollRef}
      scrollEventThrottle={16}
      {...props}
    >
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: headerBackgroundColor?.[colorScheme === 'dark' ? 'dark' : 'light'],
            height: headerHeight,
          },
          headerAnimatedStyle,
        ]}
      >
        {headerImage}
      </Animated.View>
      {enableMaskView ? (
        <ThemedView
          style={[
            {
              position: 'relative',
              flex: 1,
              top: -50,
              backgroundColor: 'transparent',
            },
            maskViewStyle,
          ]}
        >
          {enableBlurEffect ? (
            <MaskedView
              maskElement={
                <LinearGradient
                  locations={locations as unknown as readonly [number, number, ...number[]]}
                  colors={colors as unknown as readonly [string, string, ...string[]]}
                  style={StyleSheet.absoluteFill}
                />
              }
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -180,
                  height: 200,
                },
                gradientStyle,
              ]}
            >
              <BlurView intensity={blurIntensity} tint={blurTint} style={StyleSheet.absoluteFill} />
            </MaskedView>
          ) : (
            <LinearGradient
              colors={
                gradientColors ?? (colors as unknown as readonly [string, string, ...string[]])
              }
              locations={
                gradientLocations ??
                (locations as unknown as readonly [number, number, ...number[]])
              }
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -180,
                  height: 200,
                },
                gradientStyle,
              ]}
            />
          )}
          <ThemedView style={[styles.content, contentStyle]}>{children}</ThemedView>
        </ThemedView>
      ) : (
        <ThemedView style={[styles.content, contentStyle]}>{children}</ThemedView>
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
    position: 'relative',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    flex: 1,
    gap: 16,
  },
});
