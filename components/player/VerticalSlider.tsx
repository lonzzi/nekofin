import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import Animated, { SharedValue } from 'react-native-reanimated';

type VerticalSliderProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  progress: SharedValue<number>;
  minimumValue: SharedValue<number>;
  maximumValue: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
};

export function VerticalSlider({
  iconName,
  progress,
  minimumValue,
  maximumValue,
  style,
}: VerticalSliderProps) {
  return (
    <Animated.View style={[styles.container, style]} pointerEvents="none">
      <BlurView tint="dark" intensity={100} style={styles.blur}>
        <Ionicons name={iconName} size={20} color="#fff" style={styles.sliderIcon} />
        <Slider
          style={styles.verticalSlider}
          progress={progress}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          theme={{
            minimumTrackTintColor: '#fff',
            maximumTrackTintColor: 'rgba(255, 255, 255, 0.3)',
            disableMinTrackTintColor: '#fff',
          }}
          containerStyle={{
            overflow: 'hidden',
            borderRadius: 999,
          }}
          disableTapEvent={true}
          disable={true}
        />
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: '-50%' }],
    zIndex: 15,
  },
  blur: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    width: 60,
    height: 200,
  },
  sliderIcon: {
    marginBottom: 8,
  },
  verticalSlider: {
    width: 140,
    height: 40,
    transform: [{ rotate: '-90deg' }],
  },
});
