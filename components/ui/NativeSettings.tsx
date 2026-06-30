import { useAppTheme } from '@/lib/theme';
import { Button, FieldGroup, ListItem, Text as NativeText, Picker, Slider, Switch } from '@expo/ui';
import { Host as ComposeHost } from '@expo/ui/jetpack-compose';
import {
  Host as SwiftHost,
  Image as SwiftImage,
  Picker as SwiftPicker,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  controlSize,
  disabled as disabledModifier,
  frame,
  listSectionSpacing,
  pickerStyle,
  scrollContentBackground,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

export type NativeSettingsOption = {
  title: string;
  value: string;
  subtitle?: string;
};

export function NativeSettingsForm({
  children,
  testID,
  hosted = false,
  surface = 'page',
}: {
  children: ReactNode;
  testID?: string;
  hosted?: boolean;
  surface?: 'page' | 'sheet';
}) {
  const theme = useAppTheme();

  const modifiers =
    Platform.OS === 'ios'
      ? [
          listSectionSpacing('compact'),
          ...(surface === 'sheet' ? [scrollContentBackground('hidden')] : []),
        ]
      : undefined;

  const form = (
    <FieldGroup testID={testID} modifiers={modifiers}>
      {children}
    </FieldGroup>
  );

  if (hosted) {
    return form;
  }

  if (Platform.OS === 'ios') {
    return (
      <SwiftHost
        style={{
          flex: 1,
        }}
        colorScheme={theme.colorScheme}
        useViewportSizeMeasurement
      >
        {form}
      </SwiftHost>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <ComposeHost
        style={{ flex: 1 }}
        colorScheme={theme.colorScheme}
        seedColor={theme.colors.tint}
        useViewportSizeMeasurement
      >
        {form}
      </ComposeHost>
    );
  }

  return form;
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

function NativeDisclosureIndicator() {
  const theme = useAppTheme();

  if (Platform.OS === 'ios') {
    return (
      <SwiftImage
        systemName="chevron.right"
        size={15}
        color={theme.colors.textTertiary}
        modifiers={[frame({ width: 18, height: 18 })]}
      />
    );
  }

  return (
    <NativeText
      numberOfLines={1}
      textStyle={{
        color: theme.colors.textTertiary,
        fontSize: 22,
        fontWeight: '400',
        lineHeight: 24,
      }}
    >
      ›
    </NativeText>
  );
}

export function NativeSettingsItem({
  title,
  subtitle,
  leading,
  value,
  trailing,
  disclosure = false,
  onPress,
  testID,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  value?: string;
  trailing?: ReactNode;
  disclosure?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const resolvedTrailing = trailing ?? (disclosure ? <NativeDisclosureIndicator /> : value);

  return (
    <ListItem
      leading={leading}
      onPress={onPress}
      supportingText={subtitle}
      trailing={resolvedTrailing}
      testID={testID}
    >
      {title}
    </ListItem>
  );
}

export function NativeSettingsSwitch({
  title,
  subtitle,
  leading,
  value,
  onValueChange,
  disabled,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <NativeSettingsItem
      title={title}
      subtitle={subtitle}
      leading={leading}
      trailing={<Switch value={value} onValueChange={onValueChange} disabled={disabled} />}
    />
  );
}

export function NativeSettingsPicker({
  title,
  subtitle,
  leading,
  value,
  options,
  onValueChange,
  disabled,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  value: string;
  options: NativeSettingsOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const picker =
    Platform.OS === 'ios' ? (
      <SwiftPicker
        selection={value}
        onSelectionChange={(next) => onValueChange?.(String(next))}
        modifiers={[
          pickerStyle('menu'),
          tint(theme.colors.textSecondary),
          ...(disabled ? [disabledModifier(true)] : []),
        ]}
      >
        {options.map((option) => (
          <SwiftText key={option.value} modifiers={[tag(option.value)]}>
            {option.title}
          </SwiftText>
        ))}
      </SwiftPicker>
    ) : (
      <Picker
        selectedValue={value}
        onValueChange={(next) => onValueChange?.(String(next))}
        enabled={!disabled}
      >
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.title} value={option.value} />
        ))}
      </Picker>
    );

  return (
    <NativeSettingsItem title={title} subtitle={subtitle} leading={leading} trailing={picker} />
  );
}

export function NativeSettingsSlider({
  title,
  subtitle,
  leading,
  value,
  min,
  max,
  step,
  onValueChange,
  formatValue,
  disabled,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <ListItem
      leading={leading}
      trailing={displayValue}
      supportingText={
        <>
          {subtitle}
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onValueChange={onValueChange}
            modifiers={Platform.OS === 'ios' ? [tint(theme.colors.tint)] : undefined}
          />
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
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const modifiers =
    Platform.OS === 'ios' && fullWidth
      ? [frame({ maxWidth: Infinity }), controlSize('large')]
      : undefined;

  return (
    <Button
      label={label}
      onPress={onPress}
      variant={variant}
      disabled={disabled}
      modifiers={modifiers}
    />
  );
}

export function NativeSettingsText({ children }: { children: string }) {
  return <NativeText>{children}</NativeText>;
}
