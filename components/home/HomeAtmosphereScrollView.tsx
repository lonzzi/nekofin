import { HomeAtmosphereBackdrop } from '@/components/home/HomeAtmosphereBackdrop';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ComponentProps, type PropsWithChildren, type ReactElement } from 'react';
import { Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { easeGradient } from 'react-native-easing-gradient';

function getGradientColors(colors: string[]) {
  return colors as unknown as readonly [string, string, ...string[]];
}

function getGradientLocations(locations: number[]) {
  return locations as unknown as readonly [number, number, ...number[]];
}

type HomeAtmosphereImageInfo = {
  blurhash?: string;
  imageUrl?: string;
};

type HomeAtmosphereScrollViewProps = PropsWithChildren<{
  backgroundColor: string;
  contentStyle?: StyleProp<ViewStyle>;
  headerHeight: number;
  headerImage: ReactElement;
  headerOverlay?: ReactElement | null;
  imageInfo?: HomeAtmosphereImageInfo;
  isDark: boolean;
  style?: ComponentProps<typeof ParallaxScrollView>['style'];
}>;

function HeaderImageFade({ children }: PropsWithChildren) {
  const fadeGradient = useMemo(
    () =>
      easeGradient({
        colorStops: {
          0: { color: 'rgba(0,0,0,1)' },
          0.58: { color: 'rgba(0,0,0,1)' },
          0.86: { color: 'rgba(0,0,0,0.48)' },
          1: { color: 'rgba(0,0,0,0)' },
        },
        easing: Easing.bezier(0.16, 0.0, 0.18, 1),
        extraColorStopsPerTransition: 36,
      }),
    [],
  );

  return (
    <MaskedView
      style={styles.headerImageFade}
      maskElement={
        <LinearGradient
          colors={getGradientColors(fadeGradient.colors)}
          locations={getGradientLocations(fadeGradient.locations)}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      {children}
    </MaskedView>
  );
}

export function HomeAtmosphereScrollView({
  backgroundColor,
  children,
  contentStyle,
  headerHeight,
  headerImage,
  headerOverlay,
  imageInfo,
  isDark,
  style,
}: HomeAtmosphereScrollViewProps) {
  return (
    <View collapsable={false} style={[styles.container, { backgroundColor }, style]}>
      <View pointerEvents="none" style={styles.backdropLayer}>
        <HomeAtmosphereBackdrop
          backgroundColor={backgroundColor}
          blurhash={imageInfo?.blurhash}
          imageUrl={imageInfo?.imageUrl}
          isDark={isDark}
        />
      </View>

      <ParallaxScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
        headerHeight={headerHeight}
        contentStyle={[styles.content, contentStyle]}
        headerImage={<HeaderImageFade>{headerImage}</HeaderImageFade>}
        headerOverlay={headerOverlay}
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
  headerImageFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
