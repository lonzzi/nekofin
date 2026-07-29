import { StyleSheet, View } from 'react-native';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue } from 'react-native-reanimated';

import type { PlayerProgressSliderProps } from './PlayerProgressSlider.types';

const sliderTheme = {
  minimumTrackTintColor: '#FFFFFF',
  maximumTrackTintColor: 'rgba(255,255,255,0.26)',
  cacheTrackTintColor: 'rgba(255,255,255,0.46)',
};

export function PlayerProgressSlider({
  bufferedProgress,
  disabled = false,
  onSlidingComplete,
  onSlidingStart,
  progress,
}: PlayerProgressSliderProps) {
  const emptyBuffer = useSharedValue(0);
  const minimumValue = useSharedValue(0);
  const maximumValue = useSharedValue(1);

  return (
    <View style={styles.container}>
      <Slider
        cache={bufferedProgress ?? emptyBuffer}
        disable={disabled}
        disableTapEvent={false}
        maximumValue={maximumValue}
        minimumValue={minimumValue}
        onSlidingComplete={onSlidingComplete}
        onSlidingStart={onSlidingStart}
        panHitSlop={styles.hitSlop}
        progress={progress}
        sliderHeight={3}
        style={styles.slider}
        theme={sliderTheme}
        thumbTouchSize={26}
        thumbWidth={13}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  slider: {
    height: 44,
    width: '100%',
  },
  hitSlop: {
    bottom: 12,
    left: 0,
    right: 0,
    top: 12,
  },
});
