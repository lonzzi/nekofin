import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import Animated, {
  setNativeProps,
  SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PlayerGlassSurface } from './PlayerGlassSurface';

type VerticalSliderProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  progress: SharedValue<number>;
  active: SharedValue<boolean>;
  style?: StyleProp<ViewStyle>;
};

export function VerticalSlider({ iconName, progress, active, style }: VerticalSliderProps) {
  const textRef = useAnimatedRef<TextInput>();
  const [visible, setVisible] = useState(false);
  const fade = useDerivedValue<number>(() => withTiming(active.value ? 1 : 0, { duration: 140 }));
  useAnimatedReaction(
    () => active.value,
    (value, previous) => {
      if (value !== previous) scheduleOnRN(setVisible, value);
    },
  );
  const fillStyle = useAnimatedStyle(() => ({
    height: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));
  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (percent) => {
      setNativeProps(textRef, { text: `${percent}%` });
    },
  );

  return (
    <PlayerGlassSurface
      visible={visible}
      fadeProgress={fade}
      isInteractive={false}
      effectStyle="regular"
      radius={28}
      pointerEvents="none"
      style={[styles.container, style]}
      contentStyle={styles.content}
    >
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Ionicons name={iconName} size={20} color="#fff" />
      <TextInput
        accessible={false}
        editable={false}
        caretHidden
        ref={textRef}
        style={styles.value}
        defaultValue=""
        underlineColorAndroid="transparent"
      />
    </PlayerGlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: '-50%' }],
    zIndex: 15,
    width: 64,
  },
  content: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  track: {
    width: 8,
    height: 90,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'flex-end',
  },
  fill: { backgroundColor: '#fff', borderRadius: 4, width: '100%' },
  value: {
    width: 48,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    padding: 0,
    textAlign: 'center',
  },
});
