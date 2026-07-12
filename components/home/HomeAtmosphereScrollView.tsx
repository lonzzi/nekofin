import { HomeAtmosphereBackdrop } from '@/components/home/HomeAtmosphereBackdrop';
import ParallaxScrollView, {
  ParallaxHeaderFadeMask,
  resolveParallaxHeaderOverscrollExtent,
} from '@/components/ParallaxScrollView';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ComponentProps, type PropsWithChildren, type ReactElement } from 'react';
import { Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  refreshControl?: ComponentProps<typeof ParallaxScrollView>['refreshControl'];
  style?: ComponentProps<typeof ParallaxScrollView>['style'];
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
  refreshControl,
  style,
}: HomeAtmosphereScrollViewProps) {
  const insets = useSafeAreaInsets();
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

  return (
    <View collapsable={false} style={[styles.container, { backgroundColor }, style]}>
      <View pointerEvents="none" style={styles.backdropLayer}>
        <HomeAtmosphereBackdrop
          backgroundColor={backgroundColor}
          blurhash={imageInfo?.blurhash}
          imageUrl={imageInfo?.imageUrl}
          isDark={isDark}
          optimizeImageLoading={optimizeAtmosphereImageLoading}
        />
      </View>

      <ParallaxScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
        headerHeight={headerHeight}
        contentStyle={[styles.content, contentStyle]}
        headerImage={headerImage}
        headerMediaMaskElement={headerFadeMode === 'mask' ? <ParallaxHeaderFadeMask /> : null}
        headerOverscrollExtent={headerOverscrollExtent}
        headerOverlay={resolvedHeaderOverlay}
        refreshControl={refreshControl}
      >
        {children}
      </ParallaxScrollView>
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
