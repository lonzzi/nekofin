import * as NavigationBar from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as StatusBar from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
    StatusBar.setStatusBarHidden(true);

    const lockLandscape = () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };

    lockLandscape();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        lockLandscape();
      }
    });

    return () => {
      subscription.remove();
      void ScreenOrientation.unlockAsync();
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
      StatusBar.setStatusBarHidden(false);
    };
  }, []);

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
