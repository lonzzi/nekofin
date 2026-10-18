/** Native screens reapply these traits when navigating or returning from video. */
export function nativeStatusBarOptions(isDark: boolean) {
  return {
    statusBarStyle: isDark ? ('light' as const) : ('dark' as const),
    statusBarHidden: false,
  };
}

export const DETAIL_STACK_SCREEN_OPTIONS = {
  // Keep the platform default: iOS 26 uses UIKit's native full-screen back gesture.
  gestureEnabled: true,
  headerTitle: '',
  headerLargeTitle: false,
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerBlurEffect: 'none',
} as const;
