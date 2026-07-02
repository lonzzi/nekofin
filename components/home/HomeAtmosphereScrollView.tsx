import { HomeAtmosphereBackdrop } from '@/components/home/HomeAtmosphereBackdrop';
import ParallaxScrollView, {
  ParallaxHeaderFadeMask,
  resolveParallaxHeaderOverscrollExtent,
} from '@/components/ParallaxScrollView';
import type { ComponentProps, PropsWithChildren, ReactElement } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  refreshControl?: ComponentProps<typeof ParallaxScrollView>['refreshControl'];
  style?: ComponentProps<typeof ParallaxScrollView>['style'];
}>;

export function HomeAtmosphereScrollView({
  backgroundColor,
  children,
  contentStyle,
  headerHeight,
  headerImage,
  headerOverlay,
  imageInfo,
  isDark,
  refreshControl,
  style,
}: HomeAtmosphereScrollViewProps) {
  const insets = useSafeAreaInsets();
  const headerOverscrollExtent = resolveParallaxHeaderOverscrollExtent(insets.top);

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
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
        headerHeight={headerHeight}
        contentStyle={[styles.content, contentStyle]}
        headerImage={headerImage}
        headerMediaMaskElement={<ParallaxHeaderFadeMask />}
        headerOverscrollExtent={headerOverscrollExtent}
        headerOverlay={headerOverlay}
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
