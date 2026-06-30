import { DanmakuSettingsProvider } from '@/lib/contexts/DanmakuSettingsContext';
import { MediaServerProvider } from '@/lib/contexts/MediaServerContext';
import { ThemeColorProvider } from '@/lib/contexts/ThemeColorContext';
import { ThemePreferenceProvider } from '@/lib/contexts/ThemePreferenceContext';
import { storage } from '@/lib/storage';
import { useAppTheme } from '@/lib/theme';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
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

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key: string) => storage.getString(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

export default function RootLayout() {
  const [loaded] = useFonts({
    Roboto: require('../assets/fonts/Roboto-Regular.ttf'),
  });

  const segments = useSegments();

  useEffect(() => {
    if (segments.includes('player' as never)) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [segments]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
      }}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemePreferenceProvider>
          <MediaServerProvider>
            <DanmakuSettingsProvider>
              <ThemeColorProvider>
                <RootNavigation />
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={appTheme.isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
