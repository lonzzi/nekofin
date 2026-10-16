import { useMemo, useRef } from 'react';
import { Animated, ScrollView, useAnimatedValue, type ScrollViewProps } from 'react-native';

export function useParallaxMotion(headerHeight: number, onScroll?: ScrollViewProps['onScroll']) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useAnimatedValue(0);
  const scrollHandler = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollOffset } } }], {
        useNativeDriver: true,
        listener: onScroll,
      }),
    [onScroll, scrollOffset],
  );
  const headerAnimatedStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: scrollOffset.interpolate({
            inputRange: [-headerHeight, 0, headerHeight],
            outputRange: [-headerHeight / 2, 0, headerHeight * 0.75],
            extrapolate: 'clamp',
          }),
        },
        {
          scale: scrollOffset.interpolate({
            inputRange: [-headerHeight, 0, headerHeight],
            outputRange: [2, 1, 1],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [headerHeight, scrollOffset],
  );

  return {
    ScrollContainer: Animated.ScrollView,
    HeaderMedia: Animated.View,
    scrollRef,
    headerAnimatedStyle,
    onScroll: scrollHandler,
  };
}
