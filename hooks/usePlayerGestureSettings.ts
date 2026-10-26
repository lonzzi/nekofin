import { storage } from '@/lib/storage';
import { useMMKVBoolean } from 'react-native-mmkv';

export function usePlayerGestureSettings() {
  const [brightnessGestureEnabled = true, setBrightnessGestureEnabled] = useMMKVBoolean(
    'playback.brightnessGestureEnabled',
    storage,
  );
  const [volumeGestureEnabled = true, setVolumeGestureEnabled] = useMMKVBoolean(
    'playback.volumeGestureEnabled',
    storage,
  );

  return {
    brightnessGestureEnabled,
    setBrightnessGestureEnabled,
    volumeGestureEnabled,
    setVolumeGestureEnabled,
  };
}
