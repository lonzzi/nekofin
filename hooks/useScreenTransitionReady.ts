import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';

/** Native stack transition completion has the same contract on iOS and Android. */
export function useScreenTransitionReady() {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, undefined>>>();
  const focused = useIsFocused();
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!focused || finished) return;
    const finish = () => setFinished(true);
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) finish();
    });
    // An initial/deep-linked root can appear without an opening transition.
    if (navigation.getState().index === 0) finish();
    // Recover when a cancelled/restored native screen misses its end event.
    const fallback = setTimeout(finish, 1000);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [focused, navigation, finished]);

  return focused && finished;
}
