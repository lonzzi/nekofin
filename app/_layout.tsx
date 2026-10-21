import { PLAYER_LAB_AVAILABLE } from '@/components/dev/player-lab/PlayerLabEntry';
import { nativeStatusBarOptions } from '@/components/navigation/nativeStackConfig';
import { platformHeaderOptions } from '@/components/navigation/platformHeaderOptions';
import { PerformanceOverlay } from '@/components/performance/PerformanceOverlay';
import { useIsTablet } from '@/hooks/useIsTablet';
import { AppUpdateProvider } from '@/lib/contexts/AppUpdateContext';
import { DanmakuSettingsProvider } from '@/lib/contexts/DanmakuSettingsContext';
import { DanmakuSourcesProvider } from '@/lib/contexts/DanmakuSourcesContext';
import { MediaServerProvider } from '@/lib/contexts/MediaServerContext';
import { ThemePreferenceProvider } from '@/lib/contexts/ThemePreferenceContext';
import {
  PerformanceMonitorProvider,
  PerformanceRouteObserver,
  usePerformanceStackScreenListeners,
} from '@/lib/performance/PerformanceMonitorContext';
import {
  resolveVideoOrientationLock,
  resolveVideoScreenOrientation,
} from '@/lib/playerOrientation';
import {
  QUERY_CACHE_MAX_AGE_MS,
  serializeQueryCache,
  shouldPersistQuery,
} from '@/lib/queryCachePolicy';
import { createAppQueryClient } from '@/lib/queryClient';
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  queryPersistenceStorage,
} from '@/lib/queryPersistence';
import { storage } from '@/lib/storage';
import { useAppTheme } from '@/lib/theme';
import { pruneSubtitleCache } from '@/services/media/subtitleCache';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, usePathname } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMMKVString } from 'react-native-mmkv';

import 'react-native-reanimated';

const queryClient = createAppQueryClient();

const persister = createAsyncStoragePersister({
  key: QUERY_CACHE_STORAGE_KEY,
  throttleTime: 2000,
  serialize: serializeQueryCache,
  storage: queryPersistenceStorage,
});

export default function RootLayout() {
  useEffect(() => {
    void pruneSubtitleCache().catch(() => {});
  }, []);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: QUERY_CACHE_BUSTER,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
          shouldDehydrateMutation: () => false,
        },
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemePreferenceProvider>
          <MediaServerProvider>
            <DanmakuSourcesProvider>
              <DanmakuSettingsProvider>
                <PerformanceMonitorProvider>
                  <AppUpdateProvider>
                    <RootNavigation />
                    <PerformanceOverlay />
                  </AppUpdateProvider>
                </PerformanceMonitorProvider>
              </DanmakuSettingsProvider>
            </DanmakuSourcesProvider>
          </MediaServerProvider>
        </ThemePreferenceProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}

function RootNavigation() {
  const appTheme = useAppTheme();
  const tablet = useIsTablet();
  const pathname = usePathname();
  const [videoOrientation] = useMMKVString('videoOrientation', storage);
  const stackScreenListeners = usePerformanceStackScreenListeners('root');
  const isPlayerRoute = pathname === '/player' || pathname.startsWith('/player/');
  const isPlayerLabRoute = PLAYER_LAB_AVAILABLE && pathname.startsWith('/player-lab');
  const orientationLock = isPlayerRoute
    ? resolveVideoOrientationLock(videoOrientation)
    : isPlayerLabRoute
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : tablet
        ? ScreenOrientation.OrientationLock.DEFAULT
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;
  const wasPlayerRoute = useRef(isPlayerRoute);
  const deferOrientationRestore = useRef(false);
  const desiredOrientationLock = useRef(orientationLock);

  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    desiredOrientationLock.current = orientationLock;
    if (wasPlayerRoute.current && !isPlayerRoute) deferOrientationRestore.current = true;
    if (isPlayerRoute) deferOrientationRestore.current = false;
    wasPlayerRoute.current = isPlayerRoute;
    // iOS rotates with the native screen lifecycle. Android needs an explicit lock.
    const applyOrientation = async () => {
      // Keep the video Surface and navigation animation in the same window size.
      // The returning screen restores its browsing orientation after the native pop.
      if (deferOrientationRestore.current) return;
      await ScreenOrientation.lockAsync(orientationLock).catch((error) => {
        console.warn('Failed to apply the route orientation', error);
      });
    };
    void applyOrientation();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void applyOrientation();
    });
    return () => {
      subscription.remove();
    };
  }, [isPlayerRoute, orientationLock]);

  const navigationTheme = useMemo(() => {
    const baseTheme = appTheme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: appTheme.colors.tint,
        background: appTheme.colors.background,
        card: appTheme.colors.background,
        text: appTheme.colors.text,
        border: appTheme.colors.separator,
        notification: appTheme.colors.tint,
      },
    };
  }, [appTheme]);

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenListeners={stackScreenListeners}
        unstable_nativeProps={
          Platform.OS === 'android'
            ? {
                // A retained screen has no enter animation, and the popped route's
                // listeners are removed. The stack still reports the completed pop.
                onFinishTransitioning: () => {
                  if (!deferOrientationRestore.current) return;
                  deferOrientationRestore.current = false;
                  void ScreenOrientation.lockAsync(desiredOrientationLock.current).catch((error) =>
                    console.warn('Failed to restore the route orientation', error),
                  );
                },
              }
            : undefined
        }
        screenOptions={{
          ...platformHeaderOptions,
          ...nativeStatusBarOptions(appTheme.isDark),
          headerTransparent: Platform.OS === 'ios',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          orientation: Platform.OS === 'ios' ? (Platform.isPad ? 'all' : 'portrait_up') : undefined,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player"
          options={{
            // Keep the browsing screen attached and laid out behind the opaque player.
            // Reattaching its full view hierarchy during Android's pop stalls the animation.
            presentation: Platform.OS === 'android' ? 'transparentModal' : undefined,
            headerShown: false,
            animation: 'none',
            orientation:
              Platform.OS === 'ios' ? resolveVideoScreenOrientation(videoOrientation) : undefined,
            gestureEnabled: false,
            statusBarHidden: true,
            navigationBarHidden: Platform.OS === 'android' ? true : undefined,
            autoHideHomeIndicator: true,
            contentStyle: { backgroundColor: '#000' },
          }}
        />
        <Stack.Screen
          name="player-lab"
          options={{
            contentStyle: { backgroundColor: '#090B10' },
            headerShown: false,
            orientation: Platform.OS === 'ios' && PLAYER_LAB_AVAILABLE ? 'landscape' : undefined,
            statusBarHidden: PLAYER_LAB_AVAILABLE,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <PerformanceRouteObserver />
    </ThemeProvider>
  );
}
