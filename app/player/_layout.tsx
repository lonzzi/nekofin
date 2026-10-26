import { PlayerEntryVisibilityContext } from '@/components/player/PlayerEntryContext';
import { usePlayerEntryVisibility } from '@/hooks/usePlayerEntryVisibility';
import {
  resolveVideoOrientationLock,
  resolveVideoScreenOrientation,
} from '@/lib/playerOrientation';
import { storage } from '@/lib/storage';
import { Stack, type NativeStackNavigationProp } from 'expo-router';
import {
  useNavigation,
  usePreventRemove,
  type NavigationAction,
  type ParamListBase,
} from 'expo-router/react-navigation';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useLayoutEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

export default function Layout() {
  const [videoOrientation] = useMMKVString('videoOrientation', storage);
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [hasAppeared, setHasAppeared] = useState(Platform.OS !== 'ios');
  const entry = usePlayerEntryVisibility(videoOrientation, hasAppeared);
  const { width, height } = useWindowDimensions();
  const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);
  const [portraitTransitionCompleted, setPortraitTransitionCompleted] = useState(false);
  // iPad multitasking can keep a landscape window despite a portrait orientation mask.
  const coordinatePortraitExit = Platform.OS === 'ios' && !Platform.isPad;
  const canFinishExit = !coordinatePortraitExit || (portraitTransitionCompleted && width <= height);
  // Both native stacks must allow portrait before requesting the exit rotation.
  // Changing only the inner screen leaves Expo observing the outer landscape mask.
  const screenOrientation = resolveVideoScreenOrientation(
    coordinatePortraitExit && pendingExit ? 'portrait' : videoOrientation,
  );

  useEffect(() => {
    if (!coordinatePortraitExit) return;
    // Observe before an exit starts so a fast native rotation cannot beat registration.
    const subscription = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      setPortraitTransitionCompleted(
        orientationInfo.orientation === ScreenOrientation.Orientation.PORTRAIT_UP,
      );
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void ScreenOrientation.getOrientationAsync()
        .then((orientation) => {
          setPortraitTransitionCompleted(orientation === ScreenOrientation.Orientation.PORTRAIT_UP);
        })
        .catch((error) => console.warn('Failed to read the player orientation', error));
    });
    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      appStateSubscription.remove();
    };
  }, [coordinatePortraitExit]);

  useLayoutEffect(
    () =>
      navigation.addListener('transitionEnd', ({ data }) => {
        if (!data.closing) {
          setHasAppeared(true);
        }
      }),
    [navigation],
  );

  useEffect(() => {
    if (Platform.OS !== 'ios' || !hasAppeared) return;
    // A reused native screen can keep the previous viewport even though its
    // orientation mask is already correct. Request rotation after presentation.
    // Fabric applies native screen options after the JS commit. Requesting
    // rotation sooner can still hit the outgoing landscape orientation mask.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void ScreenOrientation.lockAsync(
          resolveVideoOrientationLock(
            coordinatePortraitExit && pendingExit ? 'portrait' : videoOrientation,
          ),
        ).catch((error) => console.warn('Failed to apply the player orientation', error));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [coordinatePortraitExit, hasAppeared, pendingExit, videoOrientation]);

  // Defer every platform's first exit so the root route receives its exit animation.
  usePreventRemove(!pendingExit || !canFinishExit, ({ data }) => {
    if (pendingExit) return;
    setPortraitTransitionCompleted(false);
    setPendingExit(data.action);
  });

  useEffect(() => {
    if (!pendingExit || !coordinatePortraitExit || width > height) return;
    // A player that was already portrait has no rotation event to wait for.
    let active = true;
    void ScreenOrientation.getOrientationAsync()
      .then((orientation) => {
        if (active && orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
          setPortraitTransitionCompleted(true);
        }
      })
      .catch((error) => console.warn('Failed to read the player orientation', error));
    return () => {
      active = false;
    };
  }, [coordinatePortraitExit, height, pendingExit, width]);

  useEffect(() => {
    if (!pendingExit || !canFinishExit) return;
    // Let native screens commit the animation and removal guard before starting the pop.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => navigation.dispatch(pendingExit));
    });
    return () => cancelAnimationFrame(frame);
  }, [canFinishExit, navigation, pendingExit]);

  return (
    <>
      {/* Configure the root player route before dispatching the deferred pop. */}
      <Stack.Screen
        options={{
          // Keep Android's separate video Surface in the native translation animation.
          animation: pendingExit
            ? Platform.OS === 'android'
              ? 'slide_from_bottom'
              : 'default'
            : 'none',
          animationDuration: Platform.OS === 'android' ? 220 : undefined,
          statusBarHidden: true,
          orientation: Platform.OS === 'ios' ? screenOrientation : undefined,
          navigationBarHidden: Platform.OS === 'android' ? true : undefined,
          unstable_nativeProps: androidPlayerScreenProps,
        }}
      />
      <View style={styles.container} onLayout={entry.onLayout}>
        <PlayerEntryVisibilityContext value={entry.visible}>
          <Stack
            // The native stack remains visible while its SurfaceView is detached on Android.
            unstable_nativeProps={
              Platform.OS === 'android'
                ? { nativeContainerStyle: { backgroundColor: '#000' } }
                : undefined
            }
            screenOptions={{
              headerShown: false,
              orientation: Platform.OS === 'ios' ? screenOrientation : undefined,
              statusBarHidden: true,
              navigationBarHidden: Platform.OS === 'android' ? true : undefined,
              autoHideHomeIndicator: true,
              contentStyle: { backgroundColor: '#000' },
              unstable_nativeProps: androidPlayerScreenProps,
            }}
          >
            <Stack.Screen name="index" options={{ title: '', animation: 'none' }} />
          </Stack>
        </PlayerEntryVisibilityContext>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});

// Give the native screens the same background as the video, including during removal.
const androidPlayerScreenProps =
  Platform.OS === 'android'
    ? { style: [StyleSheet.absoluteFill, { backgroundColor: '#000' }] }
    : undefined;
