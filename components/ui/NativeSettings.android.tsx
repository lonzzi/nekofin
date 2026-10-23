import { useFloatingTabBarInset } from '@/components/navigation/FloatingTabBarInset';
import { useTranslation } from '@/lib/i18n';
import { layout, useAppTheme } from '@/lib/theme';
import { ListItem, Slider, Switch, TextInput } from '@expo/ui';
import {
  AlertDialog,
  CircularProgressIndicator,
  Column,
  Host,
  LazyColumn,
  RadioButton,
  Row,
  Text,
  TextButton,
  useMaterialColors,
} from '@expo/ui/jetpack-compose';
import {
  alpha,
  background,
  defaultMinSize,
  fillMaxSize,
  fillMaxWidth,
  height,
  testID as nativeTestID,
  padding,
  selectable,
  selectableGroup,
  semantics,
  size,
  weight,
  wrapContentHeight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useState, type ComponentProps } from 'react';
import { useWindowDimensions } from 'react-native';

import type * as SharedSettings from './NativeSettings';
import { NativeSettingsGroup, NativeSettingsRows } from './NativeSettingsGroup.android';
import { settingsLayout } from './settingsLayout';

export type { NativeSettingsOption, NativeSettingsTextFieldProps } from './NativeSettings';

// Keep Android preferences separate from the SwiftUI form used on iOS.
export function NativeSettingsForm({
  children,
  testID,
  hosted = false,
  surface = 'page',
}: ComponentProps<typeof SharedSettings.NativeSettingsForm>) {
  const theme = useAppTheme();
  const tabBarInset = useFloatingTabBarInset();
  const form = (
    <LazyColumn
      contentPadding={{ top: 8, bottom: surface === 'sheet' ? 24 : Math.max(24, tabBarInset) }}
      modifiers={[
        fillMaxSize(),
        background(theme.colors.backgroundGrouped),
        ...(testID ? [nativeTestID(testID)] : []),
      ]}
    >
      {children}
    </LazyColumn>
  );
  return hosted ? (
    form
  ) : (
    <Host
      style={{ flex: 1, width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center' }}
      colorScheme={theme.colorScheme}
      useViewportSizeMeasurement
    >
      {form}
    </Host>
  );
}

export function NativeSettingsSection({
  title,
  footer,
  children,
}: ComponentProps<typeof SharedSettings.NativeSettingsSection>) {
  const colors = useMaterialColors();
  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        padding(
          settingsLayout.contentInset,
          settingsLayout.sectionSpacing,
          settingsLayout.contentInset,
          settingsLayout.sectionSpacing,
        ),
      ]}
    >
      {title ? (
        <Text
          color={colors.primary}
          style={{ typography: 'labelLarge' }}
          modifiers={[padding(settingsLayout.contentInset, 0, settingsLayout.contentInset, 8)]}
        >
          {title}
        </Text>
      ) : null}
      <NativeSettingsGroup>{children}</NativeSettingsGroup>
      {footer ? (
        <Text
          color={colors.onSurfaceVariant}
          style={{ typography: 'bodySmall' }}
          modifiers={[padding(settingsLayout.contentInset, 8, settingsLayout.contentInset, 0)]}
        >
          {footer}
        </Text>
      ) : null}
    </Column>
  );
}

export function NativeSettingsItem({
  title,
  subtitle,
  leading,
  value,
  trailing,
  onPress,
  testID,
  modifiers,
  disabled = false,
  busy = false,
}: ComponentProps<typeof SharedSettings.NativeSettingsItem>) {
  const theme = useAppTheme();
  return (
    <ListItem
      leading={leading}
      supportingText={subtitle}
      trailing={
        busy ? <CircularProgressIndicator modifiers={[size(24, 24)]} /> : (trailing ?? value)
      }
      onPress={disabled || busy ? undefined : onPress}
      colors={{ containerColor: theme.colors.surface }}
      modifiers={[
        fillMaxWidth(),
        alpha(disabled || busy ? 0.38 : 1),
        ...(testID ? [nativeTestID(testID)] : []),
        ...(modifiers ?? []),
      ]}
    >
      {title}
    </ListItem>
  );
}

export function NativeSettingsTextField({
  label,
  ...props
}: ComponentProps<typeof SharedSettings.NativeSettingsTextField>) {
  return (
    <NativeSettingsItem
      title={
        <TextInput
          {...props}
          modifiers={[
            fillMaxWidth(),
            defaultMinSize({ minHeight: settingsLayout.inputMinHeight }),
            wrapContentHeight('centerVertically'),
            semantics({ contentDescription: label }),
          ]}
        />
      }
    />
  );
}

export function NativeSettingsButton({
  label,
  onPress,
  destructive,
  accessibilityLabel,
  disabled,
}: ComponentProps<typeof SharedSettings.NativeSettingsButton>) {
  const colors = useMaterialColors();
  return (
    <TextButton
      onClick={onPress}
      enabled={!disabled}
      modifiers={
        accessibilityLabel ? [semantics({ contentDescription: accessibilityLabel })] : undefined
      }
    >
      <Text color={destructive ? colors.error : colors.primary}>{label}</Text>
    </TextButton>
  );
}

export function NativeSettingsSwitch({
  title,
  subtitle,
  leading,
  value,
  onValueChange,
  disabled,
}: ComponentProps<typeof SharedSettings.NativeSettingsSwitch>) {
  return (
    <NativeSettingsItem
      title={title}
      subtitle={subtitle}
      leading={leading}
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      trailing={<Switch value={value} onValueChange={onValueChange} disabled={disabled} />}
      modifiers={[alpha(disabled ? 0.38 : 1)]}
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
}: ComponentProps<typeof SharedSettings.NativeSettingsPicker>) {
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const colors = useMaterialColors();
  const { height: windowHeight } = useWindowDimensions();
  const selected = options.find((option) => option.value === value);
  const select = (next: string) => {
    setOpen(false);
    onValueChange?.(next);
  };

  return (
    <>
      <NativeSettingsItem
        title={title}
        leading={leading}
        subtitle={
          <Column>
            <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
              {selected?.title ?? value}
            </Text>
            {subtitle}
          </Column>
        }
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        modifiers={[alpha(disabled ? 0.38 : 1)]}
      />
      {open ? (
        <AlertDialog onDismissRequest={() => setOpen(false)}>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Text>
            <LazyColumn
              modifiers={[
                fillMaxWidth(),
                height(Math.min(options.length * 56, 320, windowHeight * 0.5)),
                selectableGroup(),
              ]}
            >
              {options.map((option) => (
                <Row
                  key={option.value}
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 16 }}
                  modifiers={[
                    fillMaxWidth(),
                    selectable(option.value === value, () => select(option.value), 'radioButton'),
                    height(56),
                    padding(0, 8, 0, 8),
                  ]}
                >
                  <RadioButton selected={option.value === value} />
                  <Column modifiers={[weight(1)]}>
                    <Text style={{ typography: 'bodyLarge' }}>{option.title}</Text>
                    {option.subtitle ? (
                      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }}>
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </Column>
                </Row>
              ))}
            </LazyColumn>
          </AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton onClick={() => setOpen(false)}>
              <Text>{tr('common.cancel')}</Text>
            </TextButton>
          </AlertDialog.ConfirmButton>
        </AlertDialog>
      ) : null}
    </>
  );
}

export function NativeSettingsChoiceList({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
}: ComponentProps<typeof SharedSettings.NativeSettingsChoiceList>) {
  const colors = useMaterialColors();
  return (
    <NativeSettingsRows modifiers={[selectableGroup(), semantics({ contentDescription: label })]}>
      {options.map((option) => (
        <Row
          key={option.value}
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: settingsLayout.contentInset }}
          modifiers={[
            fillMaxWidth(),
            selectable(
              option.value === value,
              () => {
                if (!disabled) onValueChange(option.value);
              },
              'radioButton',
            ),
            alpha(disabled ? 0.38 : 1),
            padding(
              settingsLayout.contentInset,
              settingsLayout.rowPaddingVertical,
              settingsLayout.contentInset,
              settingsLayout.rowPaddingVertical,
            ),
          ]}
        >
          <RadioButton selected={option.value === value} />
          <Column modifiers={[weight(1)]}>
            <Text color={colors.onSurface} style={{ typography: 'bodyLarge' }}>
              {option.title}
            </Text>
            {option.subtitle ? (
              <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
                {option.subtitle}
              </Text>
            ) : null}
          </Column>
        </Row>
      ))}
    </NativeSettingsRows>
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
}: ComponentProps<typeof SharedSettings.NativeSettingsSlider>) {
  return (
    <NativeSettingsItem
      title={title}
      leading={leading}
      value={formatValue ? formatValue(value) : String(value)}
      subtitle={
        <Column>
          {subtitle}
          <Slider
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onValueChange={onValueChange}
            modifiers={[fillMaxWidth()]}
          />
        </Column>
      }
    />
  );
}

export function NativeSettingsText({
  children,
}: ComponentProps<typeof SharedSettings.NativeSettingsText>) {
  return <Text>{children}</Text>;
}
