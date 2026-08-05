import {
  resolveVideoOrientationLock,
  useOrientation,
  type VideoOrientationPreference,
} from '@/hooks/useOrientation';
import { storage } from '@/lib/storage';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

type TransitionNavigation = {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data?: { closing?: boolean } }) => void,
  ) => () => void;
};

export default function Layout() {
  const navigation = useNavigation();
  const { lockOrientation } = useOrientation();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setHidden(true);
    }
    StatusBar.setHidden(true);

    const preference = (storage.getString('videoOrientation') ??
      'landscape') as VideoOrientationPreference;
    const playerOrientation = resolveVideoOrientationLock(preference);
    const parentNavigation = navigation.getParent() as unknown as TransitionNavigation | undefined;
    let active = true;
    let orientationApplied = false;
    let orientationTimer: ReturnType<typeof setTimeout> | null = null;

    const applyPlayerOrientation = () => {
      if (!active || orientationApplied) return;
      orientationApplied = true;
      void lockOrientation(playerOrientation);
    };
    const schedulePlayerOrientation = (delay: number) => {
      if (!active || orientationApplied || orientationTimer) return;
      orientationTimer = setTimeout(() => {
        orientationTimer = null;
        applyPlayerOrientation();
      }, delay);
    };

    // Let the native push finish before changing the window geometry. Locking
    // during that transition can make iOS cancel the first presentation.
    const removeTransitionListener = parentNavigation?.addListener('transitionEnd', (event) => {
      if (event.data?.closing !== true) schedulePlayerOrientation(300);
    });
    const fallbackTimer = setTimeout(() => schedulePlayerOrientation(0), 900);

    // iOS can reset the orientation lock while the app is backgrounded. Once
    // this screen has finished presenting, reapply the user's player setting.
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && orientationApplied && active) {
        void lockOrientation(playerOrientation);
      }
    });

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      if (orientationTimer) clearTimeout(orientationTimer);
      removeTransitionListener?.();
      appStateSubscription.remove();
      if (Platform.OS === 'android') {
        NavigationBar.setHidden(false);
      }
      StatusBar.setHidden(false);
    };
  }, [lockOrientation, navigation]);

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
