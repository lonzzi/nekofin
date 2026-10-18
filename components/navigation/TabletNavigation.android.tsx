import { ContentDimensionsProvider } from '@/hooks/useContentDimensions';
import { resolveTabletChrome, usesAndroidNavigationRail } from '@/lib/adaptiveLayout';
import { storage } from '@/lib/storage';
import { useAppTheme } from '@/lib/theme';
import { AndroidFloatingTabs } from '@/modules/native-layout/AndroidFloatingTabs';
import { AndroidNavigationRail } from '@/modules/native-layout/AndroidNavigationRail';
import { AndroidNavigationSurface } from '@/modules/native-layout/AndroidNavigationSurface';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import {
  BackHandler,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import { DrawerLayoutAndroid } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationCapsule } from './NavigationCapsule.android';
import { navigationDestinations as destinations } from './navigationDestinations';
import { TabletChromeContext } from './TabletChromeContext';
import { tabletDestinationKey, tabletDestinations } from './tabletDestinations';
import { useSidebarServers } from './useSidebarServers';

export function TabletNavigation({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { items: servers, homeServerId, selectServer: selectSidebarServer } = useSidebarServers();
  const destination = tabletDestinationKey(segments);
  const selected = destinations.some((entry) => entry.key === destination)
    ? destination
    : 'settings';
  const rail = usesAndroidNavigationRail(width, height);
  const [collapsed, setCollapsed] = useState(
    () => storage.getBoolean('androidPadSidebarCollapsed') ?? true,
  );
  const [drawerActive, setDrawerActive] = useState(false);
  const drawerRef = useRef<DrawerLayoutAndroid>(null);
  const collapsedRef = useRef(collapsed);
  const tabsVisible = collapsed && !drawerActive;
  const tabsAnimation = useAnimatedStyle(() => ({
    opacity: withTiming(tabsVisible ? 1 : 0, { duration: 180 }),
  }));
  const chrome = resolveTabletChrome({ width, insets });
  // Gesture Handler's native Drawer wrapper lets scrim taps cancel child carousel gestures.
  // DrawerLayout owns animation and gestures; React only keeps navigation state in sync.
  useEffect(() => {
    if (rail && !collapsed) drawerRef.current?.openDrawer();
    else drawerRef.current?.closeDrawer();
  }, [rail, collapsed]);
  const changeSidebar = useCallback((next: boolean) => {
    if (next === collapsedRef.current) return;
    if (!next) Keyboard.dismiss();
    collapsedRef.current = next;
    setCollapsed(next);
  }, []);
  const closeSidebar = useCallback(() => changeSidebar(true), [changeSidebar]);
  const toggleSidebar = useCallback(() => changeSidebar(!collapsedRef.current), [changeSidebar]);
  useEffect(() => {
    if (!rail || collapsed) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      changeSidebar(true);
      return true;
    });
    return () => subscription.remove();
  }, [rail, collapsed, changeSidebar]);
  const titleSpace = useMemo(
    () =>
      rail
        ? {
            titleMaxWidth: chrome.titleMaxWidth,
            leadingWidth: chrome.leadingWidth,
            toolbarHeight: chrome.toolbarHeight,
          }
        : null,
    [rail, chrome.titleMaxWidth, chrome.leadingWidth, chrome.toolbarHeight],
  );
  const selectDestination = useCallback(
    ({ nativeEvent: { key } }: NativeSyntheticEvent<{ key: string }>) => {
      const next = tabletDestinations.find((entry) => entry.key === key);
      if (next) {
        if (key !== 'search') Keyboard.dismiss();
        changeSidebar(true);
        router.navigate(next.href);
      }
    },
    [changeSidebar, router],
  );
  const selectServer = useCallback(
    ({ nativeEvent: { id } }: NativeSyntheticEvent<{ id: string }>) => {
      if (!selectSidebarServer(id)) return;
      changeSidebar(true);
      router.navigate('/(tabs)/(home)');
    },
    [selectSidebarServer, changeSidebar, router],
  );

  // Keep this native navigator subtree mounted through collapse and window resizing.
  // Floating navigation never changes the native screen's bounds.
  return (
    <TabletChromeContext value={titleSpace}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <DrawerLayoutAndroid
          ref={drawerRef}
          style={{ flex: 1 }}
          drawerPosition="left"
          drawerWidth={chrome.sidebarWidth + insets.left}
          drawerBackgroundColor="transparent"
          drawerLockMode={rail ? 'unlocked' : 'locked-closed'}
          keyboardDismissMode="on-drag"
          onDrawerStateChanged={(state) => {
            setDrawerActive(state !== 'Idle' || !collapsedRef.current);
          }}
          onDrawerOpen={() => {
            setDrawerActive(true);
            changeSidebar(false);
            storage.set('androidPadSidebarCollapsed', false);
          }}
          onDrawerClose={() => {
            setDrawerActive(false);
            changeSidebar(true);
            storage.set('androidPadSidebarCollapsed', true);
          }}
          renderNavigationView={() =>
            rail ? (
              <View style={[styles.sidebar, { marginLeft: insets.left }]}>
                <AndroidNavigationSurface
                  drawer
                  pointerEvents="none"
                  color={theme.colors.background}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.sidebarContent,
                    {
                      paddingTop: insets.top + 8,
                      paddingBottom: insets.bottom + 8,
                    },
                  ]}
                >
                  <AndroidNavigationRail
                    style={{ flex: 1 }}
                    destinations={destinations}
                    servers={servers}
                    selectedServerId={selected === 'home' ? (homeServerId ?? '') : ''}
                    selected={selected}
                    dark={theme.isDark}
                    backgroundColor="transparent"
                    tintColor={theme.colors.tint}
                    textColor={theme.colors.textSecondary}
                    onDestinationSelected={selectDestination}
                    onServerSelected={selectServer}
                    onToggleSidebar={closeSidebar}
                  />
                </View>
              </View>
            ) : (
              <View />
            )
          }
        >
          <View style={{ flex: 1 }}>
            <ContentDimensionsProvider width={rail ? chrome.paneWidth : undefined}>
              {children}
            </ContentDimensionsProvider>
          </View>
        </DrawerLayoutAndroid>
        {rail ? (
          <Animated.View
            pointerEvents={tabsVisible ? 'box-none' : 'none'}
            accessibilityElementsHidden={!tabsVisible}
            importantForAccessibility={tabsVisible ? 'auto' : 'no-hide-descendants'}
            style={[
              {
                position: 'absolute',
                top: insets.top + 10,
                left: 0,
                right: 0,
                alignItems: 'center',
              },
              tabsAnimation,
            ]}
          >
            <NavigationCapsule
              style={{
                width: chrome.clusterWidth,
                height: chrome.tabsHeight,
                flexDirection: 'row',
                alignItems: 'center',
                transform: [{ translateX: chrome.tabsOffset }],
              }}
            >
              <AndroidFloatingTabs
                kind="sidebar"
                style={{ width: chrome.sidebarToggleWidth, height: chrome.tabsHeight }}
                destinations={destinations}
                selected={selected}
                dark={theme.isDark}
                collapsed={collapsed}
                tintColor={theme.colors.tint}
                textColor={theme.colors.text}
                onDestinationSelected={selectDestination}
                onToggleSidebar={toggleSidebar}
              />
              <AndroidFloatingTabs
                style={{ width: chrome.tabsWidth, height: chrome.tabsHeight }}
                destinations={destinations}
                selected={selected}
                dark={theme.isDark}
                collapsed={collapsed}
                tintColor={theme.colors.tint}
                textColor={theme.colors.text}
                onDestinationSelected={selectDestination}
                onToggleSidebar={toggleSidebar}
              />
            </NavigationCapsule>
          </Animated.View>
        ) : null}
      </View>
    </TabletChromeContext>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 10,
    shadowColor: '#000000',
    backgroundColor: 'transparent',
  },
  sidebarContent: {
    flex: 1,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
});
