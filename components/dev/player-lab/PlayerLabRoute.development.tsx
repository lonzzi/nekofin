import { useOrientation } from '@/hooks/useOrientation';
import { DanmakuSettingsProvider, defaultSettings } from '@/lib/contexts/DanmakuSettingsContext';
import { NavigationBar } from 'expo-navigation-bar';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlayerLabScreen } from './PlayerLabScreen';

export function PlayerLabRoute() {
  const router = useRouter();
  const { lockOrientation } = useOrientation();
  const restorePortrait = useCallback(() => {
    // Run after the native stack has revealed its portrait-only tabs screen.
    setTimeout(() => {
      void lockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }, 80);
  }, [lockOrientation]);
  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/(settings)');
  }, [router]);

  useEffect(() => {
    StatusBar.setHidden(true);
    if (Platform.OS === 'android') NavigationBar.setHidden(true);

    return () => {
      StatusBar.setHidden(false);
      if (Platform.OS === 'android') NavigationBar.setHidden(false);
      restorePortrait();
    };
  }, [restorePortrait]);

  return (
    <GestureHandlerRootView style={{ backgroundColor: '#090B10', flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <DanmakuSettingsProvider initialSettings={defaultSettings} persist={false}>
          <PlayerLabScreen onClose={close} />
        </DanmakuSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
