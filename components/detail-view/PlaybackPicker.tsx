import { Picker, type PickerProps } from '@expo/ui';

function PlatformPlaybackPicker<T extends string | number>(
  props: PickerProps<T> & { width?: number },
) {
  return <Picker {...props} />;
}

export const PlaybackPicker = Object.assign(PlatformPlaybackPicker, { Item: Picker.Item });
