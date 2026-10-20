import { useAppTheme } from '@/lib/theme';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { createElement, useContext } from 'react';
import { Platform, type ColorValue } from 'react-native';

import { nativeStatusBarOptions } from './nativeStackConfig';
import { platformHeaderOptions } from './platformHeaderOptions';
import { TabletChromeContext, TabletHeaderTitle } from './TabletChromeContext';
import { useTabletSidebar } from './TabletSidebarContext';

export const nativeListTitleOptions = {
  headerLargeTitle: Platform.OS === 'ios' && !Platform.isPad,
} as const;

/** Let UIKit render its own navigation and scroll-edge materials on iOS 26+. */
export function useNativeListStackOptions(backgroundColor: string) {
  const theme = useAppTheme();
  const ios = Platform.OS === 'ios';
  const sidebar = useTabletSidebar();
  const chrome = useContext(TabletChromeContext);
  return {
    ...platformHeaderOptions,
    ...nativeStatusBarOptions(theme.isDark),
    orientation: Platform.OS === 'ios' ? (Platform.isPad ? 'all' : 'portrait_up') : undefined,
    headerTransparent: ios,
    ...nativeListTitleOptions,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    ...(Platform.OS === 'android' && chrome
      ? {
          headerTitle: ({ children, tintColor }: { children: string; tintColor?: ColorValue }) =>
            createElement(TabletHeaderTitle, { tintColor }, children),
        }
      : {}),
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
    // Keep the gradual blur: iOS 27 gives "automatic" a distinct, sharper material.
    scrollEdgeEffects: { top: 'soft', bottom: 'automatic' },
    contentStyle: { backgroundColor },
  } as const;
}
