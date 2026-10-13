import { resolveVideoScreenOrientation } from '@/lib/playerOrientation';
import { storage } from '@/lib/storage';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
} from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { AppState, Platform, useWindowDimensions } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

export default function Layout() {
  const [videoOrientation] = useMMKVString('videoOrientation', storage);
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);
  const [portraitTransitionCompleted, setPortraitTransitionCompleted] = useState(false);
  const canFinishExit = portraitTransitionCompleted && width <= height;
  // iPad multitasking can keep a landscape window despite a portrait orientation mask.
  const coordinatePortraitExit = Platform.OS === 'ios' && !Platform.isPad;

  usePreventRemove(coordinatePortraitExit && !canFinishExit, ({ data }) => {
    setPendingExit(data.action);
    // A portrait player can leave immediately; a landscape player remains mounted
    // until UIKit completes its rotation, so the returning screen never uses stale dimensions.
    if (width <= height) {
      void ScreenOrientation.getOrientationAsync()
        .then((orientation) => {
          if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
            setPortraitTransitionCompleted(true);
          }
        })
        .catch((error) => console.warn('Failed to read the player orientation', error));
    }
  });

  useEffect(() => {
    if (!pendingExit) return;
    const subscription = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      if (orientationInfo.orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
        setPortraitTransitionCompleted(true);
      }
    });
    // A completed rotation can be missed while Expo's registry is suspended in background.
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void ScreenOrientation.getOrientationAsync()
        .then((orientation) => {
          if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
            setPortraitTransitionCompleted(true);
          }
        })
        .catch((error) => console.warn('Failed to read the player orientation', error));
    });
    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      appStateSubscription.remove();
    };
  }, [pendingExit]);

  useEffect(() => {
    if (pendingExit && canFinishExit) navigation.dispatch(pendingExit);
  }, [canFinishExit, navigation, pendingExit]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setHidden(true);
    return () => NavigationBar.setHidden(false);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        orientation:
          Platform.OS === 'ios'
            ? pendingExit
              ? 'portrait_up'
              : resolveVideoScreenOrientation(videoOrientation)
            : undefined,
        statusBarHidden: Platform.OS === 'ios' ? true : undefined,
        autoHideHomeIndicator: true,
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="index" options={{ title: '', animation: 'none' }} />
    </Stack>
  );
}
