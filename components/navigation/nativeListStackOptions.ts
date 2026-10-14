import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform } from 'react-native';

import { platformHeaderOptions } from './platformHeaderOptions';

/** Let UIKit render its own navigation and scroll-edge materials on iOS 26+. */
export function getNativeListStackOptions(backgroundColor: string) {
  const ios = Platform.OS === 'ios';
  return {
    ...platformHeaderOptions,
    orientation: ios ? 'portrait_up' : undefined,
    headerTransparent: ios,
    headerLargeTitle: ios,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerBlurEffect: ios && !isLiquidGlassAvailable() ? 'prominent' : 'none',
    // Hero routes opt into an overlay header and inherit this style on Android too.
    headerStyle: { backgroundColor: 'transparent' },
    scrollEdgeEffects: { top: 'automatic', bottom: 'automatic' },
    contentStyle: { backgroundColor },
  } as const;
}
