import { HomeAtmosphereBackdrop } from '@/components/home/HomeAtmosphereBackdrop';
import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { nativeStatusBarOptions } from '@/components/navigation/nativeStackConfig';
import ParallaxScrollView, {
  resolveParallaxHeaderOverscrollExtent,
} from '@/components/ParallaxScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
  type ReactElement,
} from 'react';
import {
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type ScrollViewProps,
} from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

type HomeAtmosphereImageInfo = {
  blurhash?: string;
  imageUrl?: string;
};

type HomeAtmosphereScrollViewProps = PropsWithChildren<{
  backgroundColor: string;
  contentStyle?: StyleProp<ViewStyle>;
  headerHeight: number;
  headerFadeMode?: 'mask' | 'overlay';
  headerImage: ReactElement;
  headerOverlay?: ReactElement | null;
  imageInfo?: HomeAtmosphereImageInfo;
  isDark: boolean;
  optimizeAtmosphereImageLoading?: boolean;
  atmosphereImageTransitionDuration?: number;
  refreshControl?: ComponentProps<typeof ParallaxScrollView>['refreshControl'];
  style?: ComponentProps<typeof ParallaxScrollView>['style'];
  onLayout?: ComponentProps<typeof View>['onLayout'];
}>;

export function HomeAtmosphereScrollView({
  backgroundColor,
  children,
  contentStyle,
  headerHeight,
  headerFadeMode = 'mask',
  headerImage,
  headerOverlay,
  imageInfo,
  isDark,
  optimizeAtmosphereImageLoading = false,
  atmosphereImageTransitionDuration,
  refreshControl,
  style,
  onLayout,
}: HomeAtmosphereScrollViewProps) {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarInset();
  const [headerBehindStatusBar, setHeaderBehindStatusBar] = useState(true);
  const headerBehindStatusBarRef = useRef(true);
  const onScroll = useCallback<NonNullable<ScrollViewProps['onScroll']>>(
    ({ nativeEvent }) => {
      const behind = nativeEvent.contentOffset.y < Math.max(0, headerHeight * 0.66 - insets.top);
      // Only update native navigation options when crossing the artwork fade,
      // not on every scroll frame.
      if (behind === headerBehindStatusBarRef.current) return;
      headerBehindStatusBarRef.current = behind;
      setHeaderBehindStatusBar(behind);
    },
    [headerHeight, insets.top],
  );
  const statusBarOverArtwork =
    headerBehindStatusBar && !!(imageInfo?.imageUrl || imageInfo?.blurhash);
  const headerOverscrollExtent = resolveParallaxHeaderOverscrollExtent(insets.top);
  const headerFadeGradient = useMemo(() => {
    if (headerFadeMode !== 'overlay') return null;

    return easeGradient({
      colorStops: isDark
        ? {
            0: { color: 'rgba(0,0,0,0)' },
            0.66: { color: 'rgba(0,0,0,0)' },
            0.82: { color: 'rgba(0,0,0,0.04)' },
            1: { color: backgroundColor },
          }
        : {
            0: { color: 'rgba(255,255,255,0)' },
            0.66: { color: 'rgba(255,255,255,0)' },
            0.82: { color: 'rgba(255,255,255,0.04)' },
            1: { color: backgroundColor },
          },
      easing: Easing.bezier(0.33, 0.0, 0.67, 1),
      extraColorStopsPerTransition: 36,
    });
  }, [backgroundColor, headerFadeMode, isDark]);
  const resolvedHeaderOverlay =
    headerFadeMode === 'overlay' && headerFadeGradient ? (
      <>
        <LinearGradient
          colors={headerFadeGradient.colors as unknown as readonly [string, string, ...string[]]}
          locations={
            headerFadeGradient.locations as unknown as readonly [number, number, ...number[]]
          }
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { top: -headerOverscrollExtent }]}
        />
        {headerOverlay}
      </>
    ) : (
      headerOverlay
    );

  const scroller = (
    <ParallaxScrollView
      contentContainerStyle={{
        paddingBottom:
          Platform.OS === 'android' ? tabBarInset || insets.bottom + 80 : insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
      style={styles.scroller}
      headerHeight={headerHeight}
      contentStyle={[styles.content, contentStyle]}
      headerImage={headerImage}
      fadeHeaderMedia={headerFadeMode === 'mask'}
      headerOverscrollExtent={headerOverscrollExtent}
      headerOverlay={resolvedHeaderOverlay}
      refreshControl={refreshControl}
      onScroll={Platform.OS === 'android' && !isDark ? onScroll : undefined}
    >
      {Platform.OS === 'android' && isFocused && (
        <Stack.Screen options={nativeStatusBarOptions(isDark || statusBarOverArtwork)} />
      )}
      {children}
    </ParallaxScrollView>
  );

  return (
    <View
      collapsable={false}
      onLayout={onLayout}
      style={[styles.container, { backgroundColor }, style]}
    >
      <View pointerEvents="none" style={styles.backdropLayer}>
        <HomeAtmosphereBackdrop
          backgroundColor={backgroundColor}
          blurhash={imageInfo?.blurhash}
          imageUrl={imageInfo?.imageUrl}
          isDark={isDark}
          optimizeImageLoading={optimizeAtmosphereImageLoading}
          imageTransitionDuration={atmosphereImageTransitionDuration}
        />
      </View>

      {Platform.OS === 'ios' && Platform.isPad ? (
        <ScrollViewMarker
          style={styles.scroller}
          scrollEdgeEffects={{ top: 'hidden', bottom: 'hidden' }}
        >
          {scroller}
        </ScrollViewMarker>
      ) : (
        scroller
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  scroller: {
    backgroundColor: 'transparent',
    flex: 1,
    zIndex: 1,
  },
  backdropLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  content: {
    backgroundColor: 'transparent',
  },
});
