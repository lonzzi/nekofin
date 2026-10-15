import { Picker as UniversalPicker, type PickerProps } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import { disabled, lineLimit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Children, isValidElement } from 'react';

function NativePlaybackPicker<T extends string | number>({
  selectedValue,
  onValueChange,
  enabled = true,
  children,
  testID,
}: PickerProps<T>) {
  return (
    <Picker
      selection={selectedValue}
      onSelectionChange={onValueChange}
      modifiers={[pickerStyle('menu'), lineLimit(1), disabled(!enabled)]}
      testID={testID}
    >
      {Children.map(children, (child) =>
        isValidElement<{ value: T; label: string }>(child) ? (
          <Text modifiers={[tag(child.props.value), lineLimit(1)]}>{child.props.label}</Text>
        ) : null,
      )}
    </Picker>
  );
}

export const PlaybackPicker = Object.assign(NativePlaybackPicker, { Item: UniversalPicker.Item });
