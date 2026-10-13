import { PLAYER_LAB_AVAILABLE } from '@/components/dev/player-lab/PlayerLabEntry';
import { PerformanceOverlay } from '@/components/performance/PerformanceOverlay';
import { DanmakuSettingsProvider } from '@/lib/contexts/DanmakuSettingsContext';
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
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useLayoutEffect, useMemo } from 'react';
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
  const [loaded] = useFonts({
    Roboto: require('../assets/fonts/Roboto-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

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
            <DanmakuSettingsProvider>
              <PerformanceMonitorProvider>
                <RootNavigation />
                <PerformanceOverlay />
              </PerformanceMonitorProvider>
            </DanmakuSettingsProvider>
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

  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    // iOS rotates with the native screen lifecycle. Android needs an explicit lock.
    const applyOrientation = async () => {
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
  }, [orientationLock]);

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
        screenOptions={{
          headerTransparent: Platform.OS === 'ios',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          orientation: Platform.OS === 'ios' ? 'portrait_up' : undefined,
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
