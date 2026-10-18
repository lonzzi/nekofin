import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import {
  setNativeProps,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import type { VerticalGestureMode } from './gestureMath';
import { PlayerGlassSurface } from './PlayerGlassSurface';
import { useOverlayInsets } from './useOverlayInsets';

type GestureValuePreviewProps = {
  brightness: SharedValue<number>;
  volume: SharedValue<number>;
  isBrightnessActive: SharedValue<boolean>;
  isVolumeActive: SharedValue<boolean>;
};

export function GestureValuePreview({
  brightness,
  volume,
  isBrightnessActive,
  isVolumeActive,
}: GestureValuePreviewProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { topExtra } = useOverlayInsets();
  const textRef = useAnimatedRef<TextInput>();
  const [mode, setMode] = useState<VerticalGestureMode>('brightness');
  const [visible, setVisible] = useState(false);
  const activeMode = useDerivedValue<VerticalGestureMode | null>(() =>
    isBrightnessActive.get() ? 'brightness' : isVolumeActive.get() ? 'volume' : null,
  );
  const fade = useDerivedValue<number>(() =>
    withTiming(activeMode.get() ? 1 : 0, { duration: 140 }),
  );
  useAnimatedReaction(
    () => activeMode.get(),
    (next, previous) => {
      if (next === previous) return;
      // Retain the last icon and value while the shared preview fades out.
      if (next) scheduleOnRN(setMode, next);
      scheduleOnRN(setVisible, next !== null);
    },
  );
  useAnimatedReaction(
    () => {
      const active = activeMode.get();
      if (!active) return null;
      const value = active === 'brightness' ? brightness.get() : volume.get();
      return Math.round(Math.max(0, Math.min(1, value)) * 100);
    },
    (percent) => {
      if (percent !== null) setNativeProps(textRef, { text: `${percent}%` });
    },
  );
  const top = Math.max(insets.top + topExtra + 72, height * 0.2);

  return (
    <PlayerGlassSurface
      visible={visible}
      fadeProgress={fade}
      isInteractive={false}
      effectStyle="regular"
      radius={24}
      pointerEvents="none"
      style={[styles.container, { top }]}
      contentStyle={styles.content}
    >
      <Ionicons
        accessible={false}
        name={mode === 'brightness' ? 'sunny' : 'volume-high'}
        size={20}
        color="#fff"
        testID="player-gesture-preview-icon"
      />
      <TextInput
        accessible={false}
        editable={false}
        caretHidden
        ref={textRef}
        style={styles.value}
        defaultValue="0%"
        testID="player-gesture-preview-value"
        underlineColorAndroid="transparent"
      />
    </PlayerGlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    zIndex: 15,
    width: 120,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    gap: 10,
  },
  value: {
    width: 48,
    height: 24,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
