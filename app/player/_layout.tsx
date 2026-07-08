import {
  resolveVideoOrientationLock,
  useOrientation,
  type VideoOrientationPreference,
} from '@/hooks/useOrientation';
import { storage } from '@/lib/storage';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export default function Layout() {
  const { lockOrientation, unlockOrientation } = useOrientation();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(true);
    }
    StatusBar.setHidden(true);

    const preference = (storage.getString('videoOrientation') ??
      'landscape') as VideoOrientationPreference;
    const lock = resolveVideoOrientationLock(preference);

    const applyLock = () => {
      void lockOrientation(lock);
    };

    applyLock();

    // iOS 会在应用回到前台时重置方向锁,需要重新应用。
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        applyLock();
      }
    });

    return () => {
      subscription.remove();
      void unlockOrientation();
      if (Platform.OS === 'android') {
        NavigationBar.setHidden(false);
      }
      StatusBar.setHidden(false);
    };
  }, [lockOrientation, unlockOrientation]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          autoHideHomeIndicator: true,
          title: '',
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
