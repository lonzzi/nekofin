import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform } from 'react-native';

import { nativeStatusBarOptions } from './nativeStackConfig';
import { platformHeaderOptions } from './platformHeaderOptions';
import { useTabletSidebar } from './TabletSidebarContext';

/** Let UIKit render its own navigation and scroll-edge materials on iOS 26+. */
export function useNativeListStackOptions(backgroundColor: string) {
  const theme = useAppTheme();
  const ios = Platform.OS === 'ios';
  const sidebar = useTabletSidebar();
  return {
    ...platformHeaderOptions,
    ...nativeStatusBarOptions(theme.isDark),
    orientation: Platform.OS === 'ios' ? (Platform.isPad ? 'all' : 'portrait_up') : undefined,
    headerTransparent: ios,
    headerLargeTitle: Platform.OS === 'ios' && !Platform.isPad,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    ...(ios && sidebar?.isCollapsed
      ? {
          // Keep the native back button when a pushed screen also offers the sidebar.
          headerBackVisible: true,
          unstable_headerLeftItems: () => [
            {
              type: 'button' as const,
              label: '显示侧边栏',
              accessibilityLabel: '显示侧边栏',
              icon: { type: 'sfSymbol' as const, name: 'sidebar.left' as const },
              onPress: sidebar.showSidebar,
            },
          ],
        }
      : {}),
    headerBlurEffect: ios && !isLiquidGlassAvailable() ? 'prominent' : 'none',
    // Android lays non-overlay headers outside the content background. A transparent
    // toolbar exposes the outgoing screen until its native transition finishes.
    headerStyle: { backgroundColor: ios ? 'transparent' : backgroundColor },
    scrollEdgeEffects: { top: 'automatic', bottom: 'automatic' },
    contentStyle: { backgroundColor },
  } as const;
}
