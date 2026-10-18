import { layout, useAppTheme } from '@/lib/theme';
import { useIsOuterTheme } from '@/lib/theme/OuterTheme';
import { FieldGroup, Text as NativeText, type ListItemProps } from '@expo/ui';
import { Host as ComposeHost } from '@expo/ui/jetpack-compose';
import {
  Button,
  HStack,
  Menu,
  ProgressView,
  RNHostView,
  Slider,
  Spacer,
  Host as SwiftHost,
  Image as SwiftImage,
  Picker as SwiftPicker,
  Text as SwiftText,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityValue,
  buttonStyle,
  contentShape,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  listSectionSpacing,
  accessibilityLabel as nativeAccessibilityLabel,
  opacity,
  pickerStyle,
  scrollContentBackground,
  shapes,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

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
  const outer = useIsOuterTheme();

  const modifiers =
    Platform.OS === 'ios'
      ? [
          listSectionSpacing('compact'),
          ...(surface === 'sheet' || outer ? [scrollContentBackground('hidden')] : []),
          tint(theme.colors.tint),
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
          width: '100%',
          maxWidth: layout.formMaxWidth,
          alignSelf: 'center',
          backgroundColor: theme.colors.backgroundGrouped,
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
      <ComposeHost style={{ flex: 1 }} colorScheme={theme.colorScheme} useViewportSizeMeasurement>
        {form}
      </ComposeHost>
    );
  }

  return form;
}

export function NativeSettingsSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <FieldGroup.Section title={title}>
      {children}
      {footer ? (
        <FieldGroup.SectionFooter>
          <SwiftText>{footer}</SwiftText>
        </FieldGroup.SectionFooter>
      ) : null}
    </FieldGroup.Section>
  );
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

function SettingsLabel({
  title,
  subtitle,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <HStack spacing={12}>
      {leading ? (
        <RNHostView matchContents>
          <>{leading}</>
        </RNHostView>
      ) : null}
      <VStack alignment="leading" spacing={3}>
        {typeof title === 'string' ? <SwiftText>{title}</SwiftText> : title}
        {typeof subtitle === 'string' ? <SwiftText>{subtitle}</SwiftText> : subtitle}
      </VStack>
    </HStack>
  );
}

export function NativeSettingsButton({
  label,
  onPress,
  destructive,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      label={label}
      role={destructive ? 'destructive' : 'default'}
      onPress={onPress}
      modifiers={[
        buttonStyle('borderless'),
        frame({ minHeight: 44 }),
        disabledModifier(disabled),
        ...(accessibilityLabel ? [nativeAccessibilityLabel(accessibilityLabel)] : []),
      ]}
    />
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
  modifiers,
  disabled = false,
  busy = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  value?: string;
  trailing?: ReactNode;
  disclosure?: boolean;
  onPress?: () => void;
  testID?: string;
  modifiers?: ListItemProps['modifiers'];
  disabled?: boolean;
  busy?: boolean;
}) {
  const inactive = disabled || busy;
  const row = (
    <HStack
      spacing={12}
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 28, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <SettingsLabel title={title} subtitle={subtitle} leading={leading} />
      <Spacer />
      {busy ? (
        <ProgressView modifiers={[controlSize('small'), accessibilityHidden()]} />
      ) : trailing ? (
        <RNHostView matchContents>
          <>{trailing}</>
        </RNHostView>
      ) : disclosure ? (
        <NativeDisclosureIndicator />
      ) : value ? (
        <SwiftText>{value}</SwiftText>
      ) : null}
    </HStack>
  );
  const rowModifiers = [
    disabledModifier(inactive),
    ...(inactive ? [opacity(0.45)] : []),
    ...(modifiers ?? []),
  ];
  return onPress ? (
    <Button onPress={onPress} testID={testID} modifiers={[buttonStyle('plain'), ...rowModifiers]}>
      {row}
    </Button>
  ) : (
    <VStack testID={testID} alignment="leading" modifiers={rowModifiers}>
      {row}
    </VStack>
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
    <Toggle
      isOn={value}
      onIsOnChange={onValueChange}
      modifiers={[disabledModifier(!!disabled), ...(disabled ? [opacity(0.45)] : [])]}
    >
      <SettingsLabel title={title} subtitle={subtitle} leading={leading} />
    </Toggle>
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
  const selected = options.find((option) => option.value === value);
  const { fontScale } = useWindowDimensions();
  const valueLabel = (
    <HStack spacing={8}>
      <SwiftText modifiers={[foregroundStyle(theme.colors.tint)]}>
        {selected?.title ?? value}
      </SwiftText>
      <SwiftImage systemName="chevron.up.chevron.down" size={12} color={theme.colors.tint} />
    </HStack>
  );
  return (
    <Menu
      label={
        fontScale > 1.3 ? (
          <VStack
            alignment="leading"
            spacing={8}
            modifiers={[
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <SettingsLabel title={title} subtitle={subtitle} leading={leading} />
            {valueLabel}
          </VStack>
        ) : (
          <HStack
            spacing={12}
            modifiers={[
              frame({ maxWidth: Infinity, minHeight: 28, alignment: 'leading' }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <SettingsLabel title={title} subtitle={subtitle} leading={leading} />
            <Spacer />
            {valueLabel}
          </HStack>
        )
      }
      modifiers={[
        buttonStyle('plain'),
        tint(theme.colors.tint),
        disabledModifier(!!disabled),
        ...(disabled ? [opacity(0.45)] : []),
      ]}
    >
      <SwiftPicker
        label={title}
        selection={value}
        onSelectionChange={(next) => onValueChange?.(String(next))}
        modifiers={[pickerStyle('inline'), labelsHidden()]}
      >
        {options.map((option) => (
          <SwiftText key={option.value} modifiers={[tag(option.value)]}>
            {option.title}
          </SwiftText>
        ))}
      </SwiftPicker>
    </Menu>
  );
}

export function NativeSettingsChoiceList({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: NativeSettingsOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <SwiftPicker
      label={label}
      selection={value}
      onSelectionChange={(next) => onValueChange(String(next))}
      modifiers={[
        pickerStyle('inline'),
        labelsHidden(),
        tint(theme.colors.tint),
        disabledModifier(disabled),
        ...(disabled ? [opacity(0.45)] : []),
      ]}
    >
      {options.map((option) => (
        <VStack key={option.value} alignment="leading" modifiers={[tag(option.value)]}>
          <SwiftText>{option.title}</SwiftText>
          {option.subtitle ? (
            <SwiftText
              modifiers={[
                font({ textStyle: 'footnote' }),
                foregroundStyle(theme.colors.textSecondary),
              ]}
            >
              {option.subtitle}
            </SwiftText>
          ) : null}
        </VStack>
      ))}
    </SwiftPicker>
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
  const { fontScale } = useWindowDimensions();

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[disabledModifier(!!disabled), ...(disabled ? [opacity(0.45)] : [])]}
    >
      {fontScale > 1.3 ? (
        <VStack alignment="leading" spacing={4} modifiers={[accessibilityHidden()]}>
          <SettingsLabel title={title} leading={leading} />
          <SwiftText>{displayValue}</SwiftText>
        </VStack>
      ) : (
        <HStack spacing={12} modifiers={[accessibilityHidden()]}>
          <SettingsLabel title={title} leading={leading} />
          <Spacer />
          <SwiftText>{displayValue}</SwiftText>
        </HStack>
      )}
      {subtitle}
      <Slider
        label={title}
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onValueChange}
        modifiers={[tint(theme.colors.tint), accessibilityValue(displayValue)]}
      />
    </VStack>
  );
}

export function NativeSettingsText({ children }: { children: string }) {
  return <NativeText>{children}</NativeText>;
}
