import { parsePlayerSeekSeconds } from '@/lib/playerSeekSettings';
import { storage } from '@/lib/storage';
import { useMMKVNumber } from 'react-native-mmkv';

export function usePlayerSeekSettings() {
  const [backward, setBackwardSeconds] = useMMKVNumber('playback.seekBackwardSeconds', storage);
  const [forward, setForwardSeconds] = useMMKVNumber('playback.seekForwardSeconds', storage);
  return {
    backwardSeconds: parsePlayerSeekSeconds(backward),
    forwardSeconds: parsePlayerSeekSeconds(forward),
    setBackwardSeconds,
    setForwardSeconds,
  };
}
