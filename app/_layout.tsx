import { PerformanceOverlay } from '@/components/performance/PerformanceOverlay';
import { DanmakuSettingsProvider } from '@/lib/contexts/DanmakuSettingsContext';
import { MediaServerProvider } from '@/lib/contexts/MediaServerContext';
import { ThemeColorProvider } from '@/lib/contexts/ThemeColorContext';
import { ThemePreferenceProvider } from '@/lib/contexts/ThemePreferenceContext';
import {
  PerformanceInteractionCapture,
  PerformanceMonitorProvider,
  PerformanceRouteObserver,
} from '@/lib/performance/PerformanceMonitorContext';
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_STORAGE_KEY,
  queryPersistenceStorage,
} from '@/lib/queryPersistence';
import { useAppTheme } from '@/lib/theme';
import { mediaQueryKeys } from '@/services/media/queryKeys';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
              <ThemeColorProvider>
                <PerformanceMonitorProvider>
                  <PerformanceInteractionCapture>
                    <RootNavigation />
                    <PerformanceOverlay />
                  </PerformanceInteractionCapture>
                </PerformanceMonitorProvider>
              </ThemeColorProvider>
            </DanmakuSettingsProvider>
          </MediaServerProvider>
        </ThemePreferenceProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}

function RootNavigation() {
  const appTheme = useAppTheme();

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
        screenOptions={{
          headerTransparent: Platform.OS === 'ios',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, orientation: 'portrait_up' }} />
        <Stack.Screen name="player" options={{ headerShown: false, orientation: 'landscape' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <PerformanceRouteObserver />
      <StatusBar style={appTheme.isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
