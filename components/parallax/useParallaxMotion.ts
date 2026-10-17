import type { ScrollViewProps } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';

export function useParallaxMotion(headerHeight: number, onScroll?: ScrollViewProps['onScroll']) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle(() => ({
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
  }));

  return {
    ScrollContainer: Animated.ScrollView,
    HeaderMedia: Animated.View,
    scrollRef,
    headerAnimatedStyle,
    onScroll,
  };
}
