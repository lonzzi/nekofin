import { Dimensions, useWindowDimensions } from 'react-native';

import { resolveMediaHeroHeight } from './tokens';

export function useMediaHeroHeight() {
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;

  return resolveMediaHeroHeight(Math.max(screenHeight, windowHeight));
}
