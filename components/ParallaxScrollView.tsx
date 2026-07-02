import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurTint, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactElement } from 'react';
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

const HEADER_HEIGHT = 450;

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
  style,
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
    <Animated.View style={[styles.headerMedia, headerAnimatedStyle]}>{headerImage}</Animated.View>
  );

  return (
    <Animated.ScrollView
      style={[styles.container, containerStyle, style]}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      automaticallyAdjustContentInsets={automaticallyAdjustContentInsets}
      automaticallyAdjustsScrollIndicatorInsets={automaticallyAdjustsScrollIndicatorInsets}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      ref={scrollRef}
      scrollEventThrottle={8}
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
              height: headerHeight,
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
            <View pointerEvents="box-none" style={styles.headerOverlay}>
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
    top: 0,
    right: 0,
    bottom: 0,
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
