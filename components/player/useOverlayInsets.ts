import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { derivePlayerOverlayLayout } from './playerLayout';

export function useOverlayInsets() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => derivePlayerOverlayLayout(width, height), [height, width]);
}
