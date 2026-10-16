import { PLAYER_LAB_AVAILABLE } from '@/components/dev/player-lab/PlayerLabEntry';
import { platformHeaderOptions } from '@/components/navigation/platformHeaderOptions';
import { PerformanceOverlay } from '@/components/performance/PerformanceOverlay';
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
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  queryPersistenceStorage,
} from '@/lib/queryPersistence';
import { storage } from '@/lib/storage';
import { useAppTheme } from '@/lib/theme';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, usePathname } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useMMKVString } from 'react-native-mmkv';

import 'react-native-reanimated';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retryOnMount: true,
      structuralSharing: true,
    },
  },
});

function shouldPersistQuery(query: Query) {
  return defaultShouldDehydrateQuery(query) && query.queryKey[0] !== mediaQueryKeys.all[0];
}

const persister = createAsyncStoragePersister({
  key: QUERY_CACHE_STORAGE_KEY,
  storage: queryPersistenceStorage,
});

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: QUERY_CACHE_BUSTER,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemePreferenceProvider>
          <MediaServerProvider>
            <DanmakuSourcesProvider>
              <DanmakuSettingsProvider>
                <PerformanceMonitorProvider>
                  <RootNavigation />
                  <PerformanceOverlay />
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
  const pathname = usePathname();
  const [videoOrientation] = useMMKVString('videoOrientation', storage);
  const stackScreenListeners = usePerformanceStackScreenListeners('root');
  const isPlayerRoute = pathname === '/player' || pathname.startsWith('/player/');
  const isPlayerLabRoute = PLAYER_LAB_AVAILABLE && pathname.startsWith('/player-lab');
  const orientationLock = isPlayerRoute
    ? resolveVideoOrientationLock(videoOrientation)
    : isPlayerLabRoute
      ? ScreenOrientation.OrientationLock.LANDSCAPE
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
      // The returning screen's transitionEnd restores portrait after the native pop.
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
        screenListeners={(props) => {
          const listeners = stackScreenListeners(props);
          return {
            ...listeners,
            transitionEnd: (event) => {
              listeners.transitionEnd(event);
              // The popped player's listeners may already be removed. The returning
              // screen remains mounted and reports completion of the same transition.
              if (event.data.closing || !deferOrientationRestore.current) return;
              deferOrientationRestore.current = false;
              void ScreenOrientation.lockAsync(desiredOrientationLock.current).catch((error) => {
                console.warn('Failed to restore the route orientation', error);
              });
            },
          };
        }}
        screenOptions={{
          ...platformHeaderOptions,
          headerTransparent: Platform.OS === 'ios',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          orientation: Platform.OS === 'ios' ? (Platform.isPad ? 'all' : 'portrait_up') : undefined,
          statusBarHidden: Platform.OS === 'ios' ? false : undefined,
          statusBarStyle: Platform.OS === 'ios' ? (appTheme.isDark ? 'light' : 'dark') : undefined,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            animation: 'none',
            orientation:
              Platform.OS === 'ios' ? resolveVideoScreenOrientation(videoOrientation) : undefined,
            gestureEnabled: false,
            statusBarHidden: Platform.OS === 'ios' ? true : undefined,
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
            statusBarHidden: Platform.OS === 'ios' && PLAYER_LAB_AVAILABLE ? true : undefined,
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <PerformanceRouteObserver />
      {Platform.OS !== 'ios' && (
        <StatusBar
          hidden={isPlayerRoute || isPlayerLabRoute}
          style={appTheme.isDark ? 'light' : 'dark'}
        />
      )}
    </ThemeProvider>
  );
}
