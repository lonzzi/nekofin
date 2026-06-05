import { Button, FieldGroup, ListItem, Text as NativeText, Picker, Slider, Switch } from '@expo/ui';
import type { ReactNode } from 'react';

export type NativeSettingsOption = {
  title: string;
  value: string;
  subtitle?: string;
};

export function NativeSettingsForm({ children, testID }: { children: ReactNode; testID?: string }) {
  return <FieldGroup testID={testID}>{children}</FieldGroup>;
}

export function NativeSettingsSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return <FieldGroup.Section title={title}>{children}</FieldGroup.Section>;
}

export function NativeSettingsItem({
  title,
  subtitle,
  value,
  trailing,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <ListItem
      onPress={onPress}
      supportingText={subtitle}
      trailing={trailing ?? value}
      testID={testID}
    >
      {title}
    </ListItem>
  );
}

export function NativeSettingsSwitch({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSettingsItem
      title={title}
      subtitle={subtitle}
      trailing={<Switch value={value} onValueChange={onValueChange} disabled={disabled} />}
    />
  );
}

export function NativeSettingsPicker({
  title,
  subtitle,
  value,
  options,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: string;
  options: NativeSettingsOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSettingsItem
      title={title}
      subtitle={subtitle}
      trailing={
        <Picker
          selectedValue={value}
          onValueChange={(next) => onValueChange?.(String(next))}
          enabled={!disabled}
        >
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.title} value={option.value} />
          ))}
        </Picker>
      }
    />
  );
}

export function NativeSettingsSlider({
  title,
  subtitle,
  value,
  min,
  max,
  step,
  onValueChange,
  formatValue,
}: {
  title: string;
  subtitle?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <ListItem
      trailing={displayValue}
      supportingText={
        <>
          {subtitle ? <NativeText>{subtitle}</NativeText> : null}
          <Slider value={value} min={min} max={max} step={step} onValueChange={onValueChange} />
        </>
      }
    >
      {title}
    </ListItem>
  );
}

export function NativeSettingsButton({
  label,
  onPress,
  variant = 'filled',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  disabled?: boolean;
}) {
  return <Button label={label} onPress={onPress} variant={variant} disabled={disabled} />;
}

export function NativeSettingsText({ children }: { children: string }) {
  return <NativeText>{children}</NativeText>;
}
