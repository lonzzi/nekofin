import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurTint, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type PropsWithChildren, type ReactElement } from 'react';
import {
  Easing,
  Platform,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 450;
const HEADER_OVERSCROLL_SAFE_AREA_OFFSET = 260;
const HEADER_OVERSCROLL_MIN = 240;

function getGradientColors(colors: string[]) {
  return colors as unknown as readonly [string, string, ...string[]];
}

function getGradientLocations(locations: number[]) {
  return locations as unknown as readonly [number, number, ...number[]];
}

export function resolveParallaxHeaderOverscrollExtent(topInset: number) {
  return Math.max(topInset + HEADER_OVERSCROLL_SAFE_AREA_OFFSET, HEADER_OVERSCROLL_MIN);
}

export function useParallaxHeaderOverscrollExtent() {
  const insets = useSafeAreaInsets();

  return resolveParallaxHeaderOverscrollExtent(insets.top);
}

export function ParallaxHeaderFadeMask() {
  const fadeGradient = useMemo(
    () =>
      easeGradient({
        colorStops: {
          0: { color: 'rgba(0,0,0,1)' },
          0.66: { color: 'rgba(0,0,0,1)' },
          0.82: { color: 'rgba(0,0,0,0.96)' },
          1: { color: 'rgba(0,0,0,0)' },
        },
        easing: Easing.bezier(0.33, 0.0, 0.67, 1),
        extraColorStopsPerTransition: 36,
      }),
    [],
  );

  return (
    <LinearGradient
      colors={getGradientColors(fadeGradient.colors)}
      locations={getGradientLocations(fadeGradient.locations)}
      style={StyleSheet.absoluteFill}
    />
  );
}

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerOverlay?: ReactElement | null;
  headerBackgroundColor?: { dark: string; light: string };
  headerHeight?: number;
  enableMaskView?: boolean;
  enableBlurEffect?: boolean;
  blurIntensity?: number;
  blurTint?: BlurTint;
  containerStyle?: StyleProp<ViewStyle>;
  contentBackground?: ReactElement | null;
  contentStyle?: StyleProp<ViewStyle>;
  scrollBackground?: ReactElement | null;
  maskViewStyle?: StyleProp<ViewStyle>;
  gradientStyle?: StyleProp<ViewStyle>;
  gradientColors?: readonly [string, string, ...string[]];
  gradientLocations?: readonly [number, number, ...number[]];
  headerMediaMaskElement?: ReactElement | null;
  headerOverscrollExtent?: number;
}> &
  ScrollViewProps;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerOverlay,
  headerBackgroundColor,
  headerHeight = HEADER_HEIGHT,
  enableMaskView = false,
  enableBlurEffect = false,
  blurIntensity = 100,
  blurTint = Platform.OS === 'ios' ? 'systemChromeMaterialDark' : 'systemMaterialDark',
  containerStyle,
  contentBackground,
  contentStyle,
  contentContainerStyle,
  scrollBackground,
  automaticallyAdjustContentInsets = false,
  automaticallyAdjustsScrollIndicatorInsets = false,
  contentInsetAdjustmentBehavior = 'never',
  maskViewStyle,
  gradientStyle,
  gradientColors,
  gradientLocations,
  headerMediaMaskElement,
  headerOverscrollExtent = 0,
  style,
  ...props
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const gradientStartColor = colorScheme === 'light' ? 'rgba(252,255,255,0)' : 'rgba(0,0,0,0)';
  const gradientEndColor = colorScheme === 'light' ? 'rgba(252,255,255,1)' : 'rgba(0,0,0,1)';

  const { colors, locations } = useMemo(() => {
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

    return easeGradient({
      colorStops: blurGradientColors as any,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      extraColorStopsPerTransition: 24,
    });
  }, [enableBlurEffect, gradientStartColor, gradientEndColor]);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-headerHeight, 0, headerHeight],
            [2, 1, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const content = (
    <ThemedView style={[styles.content, contentStyle]}>
      {!!contentBackground && (
        <View pointerEvents="none" style={styles.contentBackground}>
          {contentBackground}
        </View>
      )}
      {children}
    </ThemedView>
  );

  const headerMedia = (
    <Animated.View
      style={[
        styles.headerMedia,
        { height: headerHeight, top: headerOverscrollExtent },
        headerAnimatedStyle,
      ]}
    >
      {headerImage}
    </Animated.View>
  );

  return (
    <Animated.ScrollView
      style={[styles.container, containerStyle, style]}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      automaticallyAdjustContentInsets={automaticallyAdjustContentInsets}
      automaticallyAdjustsScrollIndicatorInsets={automaticallyAdjustsScrollIndicatorInsets}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      ref={scrollRef}
      scrollEventThrottle={16}
      {...props}
    >
      <View style={styles.scrollBody}>
        {!!scrollBackground && (
          <View pointerEvents="none" style={styles.scrollBackground}>
            {scrollBackground}
          </View>
        )}
        <View
          style={[
            styles.header,
            {
              backgroundColor: headerBackgroundColor?.[colorScheme === 'dark' ? 'dark' : 'light'],
              height: headerHeight + headerOverscrollExtent,
              marginTop: -headerOverscrollExtent,
            },
          ]}
        >
          {headerMediaMaskElement ? (
            <MaskedView maskElement={headerMediaMaskElement} style={styles.headerMediaMask}>
              {headerMedia}
            </MaskedView>
          ) : (
            headerMedia
          )}
          {!!headerOverlay && (
            <View
              pointerEvents="box-none"
              style={[styles.headerOverlay, { top: headerOverscrollExtent }]}
            >
              {headerOverlay}
            </View>
          )}
        </View>
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
                <BlurView
                  intensity={blurIntensity}
                  tint={blurTint}
                  style={StyleSheet.absoluteFill}
                />
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
            {content}
          </ThemedView>
        ) : (
          content
        )}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollBody: {
    flexGrow: 1,
    position: 'relative',
  },
  scrollBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  header: {
    overflow: 'hidden',
    position: 'relative',
  },
  headerMedia: {
    position: 'absolute',
    right: 0,
    left: 0,
  },
  headerMediaMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  content: {
    flex: 1,
    gap: 16,
    position: 'relative',
  },
  contentBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
