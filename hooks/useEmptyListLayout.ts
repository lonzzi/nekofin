import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useEmptyListLayout() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  // Automatic iOS insets occupy space inside the scroll view's full frame.
  const occupiedHeight = Platform.OS === 'ios' ? headerHeight + insets.bottom : 0;

  return {
    onLayout,
    emptyContentStyle: {
      flexGrow: 0,
      minHeight: Math.max(0, (viewportHeight || windowHeight) - occupiedHeight),
    },
  };
}
