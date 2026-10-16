import { Picker as UniversalPicker, type PickerProps } from '@expo/ui';
import { HStack, Image, Menu, Picker, Text } from '@expo/ui/swift-ui';
import {
  disabled,
  font,
  frame,
  lineLimit,
  pickerStyle,
  tag,
  truncationMode,
} from '@expo/ui/swift-ui/modifiers';
import { Children, isValidElement } from 'react';

function NativePlaybackPicker<T extends string | number>({
  selectedValue,
  onValueChange,
  enabled = true,
  children,
  testID,
  width,
}: PickerProps<T> & { width?: number }) {
  const options = Children.toArray(children).filter(isValidElement<{ value: T; label: string }>);
  const picker = (
    <Picker
      label={width ? '' : undefined}
      selection={selectedValue}
      onSelectionChange={onValueChange}
      modifiers={[pickerStyle(width ? 'inline' : 'menu'), lineLimit(1), disabled(!enabled)]}
      testID={width ? undefined : testID}
    >
      {options.map((child) => (
        <Text key={child.props.value} modifiers={[tag(child.props.value), lineLimit(1)]}>
          {child.props.label}
        </Text>
      ))}
    </Picker>
  );
  if (!width) return picker;

  // Keep long filenames inside the column; the native menu retains their full labels.
  const selectedLabel = options.find((child) => child.props.value === selectedValue)?.props.label;
  return (
    <Menu
      label={
        <HStack spacing={6}>
          <Text
            modifiers={[
              lineLimit(1),
              truncationMode('middle'),
              frame({ maxWidth: width - 20, alignment: 'trailing' }),
            ]}
          >
            {selectedLabel ?? ''}
          </Text>
          <Image systemName="chevron.up.chevron.down" modifiers={[font({ size: 11 })]} />
        </HStack>
      }
      modifiers={[disabled(!enabled), frame({ width, height: 44, alignment: 'trailing' })]}
      testID={testID}
    >
      {picker}
    </Menu>
  );
}

export const PlaybackPicker = Object.assign(NativePlaybackPicker, { Item: UniversalPicker.Item });
