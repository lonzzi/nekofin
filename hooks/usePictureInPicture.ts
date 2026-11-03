import { storage } from '@/lib/storage';
import { useMMKVBoolean } from 'react-native-mmkv';

export function usePictureInPicture() {
  const [enabled = true, setEnabled] = useMMKVBoolean('playback.pictureInPicture', storage);
  return { enabled, setEnabled };
}
