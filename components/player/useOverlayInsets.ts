import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { derivePlayerOverlayLayout } from './playerLayout';

export function useOverlayInsets() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const layout = derivePlayerOverlayLayout(width, height);
    return {
      ...layout,
      side: layout.side + (Platform.OS === 'android' ? 16 : 0),
      safeSideGap: Platform.OS === 'android' ? 24 : 8,
    };
  }, [height, width]);
}
