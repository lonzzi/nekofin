import { useState } from 'react';
import { SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useCurrentTime({ time }: { time: SharedValue<number> }) {
  const [currentTime, setCurrentTime] = useState(0);

  useAnimatedReaction(
    () => Math.floor(time.value / 1000),
    (newSecond, previousSecond) => {
      if (newSecond === previousSecond) return;
      scheduleOnRN(setCurrentTime, newSecond * 1000);
    },
  );

  return currentTime;
}
